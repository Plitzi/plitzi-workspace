import { describe, expect, it, vi } from 'vitest';

import { container, heading, list, text } from '../elements';
import { authorSpace } from '../index';
import { describeFindings, inspectDocument, inspectPage } from './inspect';
import { onScreen } from './onScreen';
import { singlePageSpace, withElement } from './variants';

import type { PageEvaluator } from './inspect';
import type { ProbeFindings } from './probe';
import type { SpaceSpec } from '../schema';

/**
 * The testing half is a contract with every suite written against a space: what a page owes on being opened, what a
 * failure says, and that a variant of a space is still a space authoring would accept.
 */

const spec: SpaceSpec = {
  name: 'Testing',
  permanentUrl: 'testing',
  layouts: [
    { id: 'outer', body: [container({ id: 'outer-bar', children: [container({ id: 'outer-slot' })] })] },
    {
      id: 'inner',
      layout: { id: 'outer', slot: 'outer-slot' },
      body: [container({ id: 'inner-nav' }), container({ id: 'inner-slot' })]
    }
  ],
  pages: [
    {
      name: 'Home',
      slug: '',
      id: 'home',
      layout: { id: 'inner', slot: 'inner-slot' },
      body: [
        heading('Hi', { id: 'title', subType: 'h1' }),
        text('unnamed'),
        container({ id: 'drawer', visible: 'state.open', children: [text('inside', { id: 'drawer-link' })] }),
        list({ id: 'rows', source: 'controlled', items: [{ n: 1 }], children: [text('row', { id: 'row-label' })] })
      ]
    },
    { name: 'About', slug: 'about', id: 'about', body: [heading('About', { id: 'about-title' })] }
  ]
};

const { handles } = authorSpace(spec);

const clean: ProbeFindings = {
  marked: true,
  missing: [],
  hidden: [],
  brokenImages: [],
  overflow: null,
  illegible: []
};

describe('testing/onScreen', () => {
  it('owes the named elements of the page and of every shell around it, outermost first', () => {
    expect(onScreen(handles, 'home').map(handle => handle.id)).toEqual([
      'outer-bar',
      'outer-slot',
      'inner-nav',
      'inner-slot',
      'title',
      'rows'
    ]);
  });

  /** A condition, a list row and the derived ids are what a bare visit cannot promise. */
  it('leaves out what is conditional or repeated, and the unnamed unless asked', () => {
    const ids = onScreen(handles, 'home').map(handle => handle.id);

    expect(ids).not.toContain('drawer');
    expect(ids).not.toContain('drawer-link');
    expect(ids).not.toContain('row-label');
    expect(onScreen(handles, 'home', { elements: 'all' }).some(handle => !handle.named)).toBe(true);
  });

  it('reads a page by slug too, and one with no layout owes only its own', () => {
    expect(onScreen(handles, 'about').map(handle => handle.id)).toEqual(['about-title']);
  });

  /** An ignore list that silently accepted a typo would widen the check without anybody noticing. */
  it('refuses to ignore an element that does not exist', () => {
    expect(onScreen(handles, 'home', { ignore: ['rows'] }).map(handle => handle.id)).not.toContain('rows');
    expect(() => onScreen(handles, 'home', { ignore: ['titel'] })).toThrow(/did you mean "title"/);
  });
});

describe('testing/describeFindings', () => {
  const owed = onScreen(handles, 'home');

  it('says nothing about a whole page', () => {
    expect(describeFindings(owed, clean)).toEqual([]);
  });

  /** The sentence a failure prints is the whole point: type, name and the reason, not "locator not visible". */
  it('names each problem with the element, its type and why', () => {
    expect(
      describeFindings(owed, {
        ...clean,
        missing: ['title'],
        hidden: [{ id: 'rows', reason: 'display:none on "inner-slot"' }],
        brokenImages: ['https://cdn.test/logo.png'],
        overflow: { pixels: 37, widest: ['<img.cover>'] },
        illegible: ['"title": "Hi"']
      })
    ).toEqual([
      'heading "title" is not on the page',
      'list "rows" is on the page but not visible: display:none on "inner-slot"',
      'an image never loaded: https://cdn.test/logo.png',
      'the page scrolls sideways by 37px — widest: <img.cover>',
      'text drawn in the colour behind it: "title": "Hi"'
    ]);
  });

  /** Six "is not on the page" lines for one cause would bury it: nothing rendered, or the markers are off. */
  it('says once that nothing rendered, rather than listing every element', () => {
    expect(describeFindings(owed, { ...clean, marked: false, missing: owed.map(handle => handle.id) })).toEqual([
      expect.stringMatching(/nothing on the page carries data-plitzi-el/)
    ]);
  });
});

describe('testing/inspectPage', () => {
  const driver = (answers: ProbeFindings[]): PageEvaluator & { calls: number } => {
    const fake = {
      calls: 0,
      evaluate: <R>(): Promise<R> => {
        const answer = answers[Math.min(fake.calls, answers.length - 1)];
        fake.calls += 1;

        // The fake stands in for the browser: what it returns IS the probe's answer.
        return Promise.resolve(answer as R);
      }
    };

    return fake;
  };

  it('inspects the home page by default and reports what it checked', async () => {
    const report = await inspectPage(driver([clean]), handles);

    expect(report).toEqual({ page: 'home', checked: 6, problems: [] });
  });

  /** A provider still answering is a missing element for a few frames — the same retry an assertion would give it. */
  it('looks again until the page is whole, like an assertion retries', async () => {
    vi.useFakeTimers();
    const fake = driver([{ ...clean, missing: ['title'] }, clean]);
    const pending = inspectPage(fake, handles, { timeout: 1000 });
    await vi.advanceTimersByTimeAsync(200);

    expect((await pending).problems).toEqual([]);
    expect(fake.calls).toBe(2);
    vi.useRealTimers();
  });

  it('reports what is still wrong when the time is up', async () => {
    const report = await inspectPage(driver([{ ...clean, missing: ['title'] }]), handles, { timeout: 0 });

    expect(report.problems).toEqual(['heading "title" is not on the page']);
  });

  /** An example served by somebody else's server has no handles, and still owes images, width and legible text. */
  it('checks a document with no space in hand, owing no elements', async () => {
    const report = await inspectDocument(driver([{ ...clean, marked: false, brokenImages: ['/x.png'] }]), {
      timeout: 0
    });

    expect(report).toEqual({ page: 'document', checked: 0, problems: ['an image never loaded: /x.png'] });
  });

  it('names a page that does not exist', async () => {
    await expect(inspectPage(driver([clean]), handles, { page: 'abuot' })).rejects.toThrow(/did you mean "about"/);
  });
});

describe('testing/variants', () => {
  it('builds a one-page space from a body, with anything else merged in', () => {
    const one = singlePageSpace([heading('Hi', { id: 'title' })], { name: 'One', page: { seoTitle: 'One' } });

    expect(one.name).toBe('One');
    expect(one.pages).toEqual([{ name: 'Home', slug: '', seoTitle: 'One', body: [heading('Hi', { id: 'title' })] }]);
    expect(() => authorSpace(one)).not.toThrow();
  });

  it('changes one element anywhere in the tree, merging its attributes, and leaves the original alone', () => {
    const changed = withElement(spec, 'drawer-link', { attributes: { content: 'changed' } });
    const find = (space: SpaceSpec) => authorSpace(space).schema.flat['drawer-link'].attributes;

    expect(find(changed)).toMatchObject({ content: 'changed' });
    expect(find(spec)).toMatchObject({ content: 'inside' });
  });

  it('reaches into layouts as well as pages', () => {
    const changed = withElement(spec, 'inner-nav', { css: { display: 'none' } });

    expect(changed.layouts?.[1].body[0]).toMatchObject({ id: 'inner-nav', css: { display: 'none' } });
  });

  /** A variant is authored like any space, so a patch that breaks the element is refused the same way. */
  it('refuses an id the space does not have, with the nearest one', () => {
    expect(() => withElement(spec, 'titel', {})).toThrow(
      /No element with id "titel" in "Testing" — did you mean "title"/
    );
  });
});
