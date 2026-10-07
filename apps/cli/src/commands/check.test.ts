// @vitest-environment jsdom
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkAccount,
  clickedText,
  contestedText,
  inertText,
  listText,
  momentChanges,
  notShownInPage,
  pageFor,
  renderedRowsInPage
} from './check';

const marked = (id: string): string => `[data-plitzi-el="${id}"]`;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('plitzi page check / a list’s rows', () => {
  it('counts the rows the page draws, one per copy of the row inside the list, and none for a list not on it', () => {
    document.body.innerHTML = `
      <ul data-plitzi-el="feed">
        <li data-plitzi-el="feed-row"><span data-plitzi-el="feed-badge"></span></li>
        <li data-plitzi-el="feed-row"></li>
        <li data-plitzi-el="feed-row"><span data-plitzi-el="feed-badge"></span></li>
      </ul>
      <ul data-plitzi-el="empty"></ul>`;

    expect(
      renderedRowsInPage([
        { id: 'feed', selector: marked('feed'), row: [marked('feed-badge'), marked('feed-row')] },
        { id: 'empty', selector: marked('empty'), row: [marked('empty-row')] },
        { id: 'hits', selector: marked('hits'), row: [marked('hits-row')] }
      ])
    ).toEqual([
      ['feed', 3],
      ['empty', 0],
      ['hits', null]
    ]);
  });

  it('says what is drawn beside what the source holds', () => {
    expect(listText('plan-list', { rendered: 3, source: 3 })).toBe('plan-list 3 rows');
    expect(listText('home-writer-list', { rendered: 4, source: 8 })).toBe('home-writer-list 4 of 8 rows');
    expect(listText('search-hits', { rendered: null, source: 16 })).toBe('search-hits not rendered (16 in its source)');
    expect(listText('feed', { rendered: 0, source: null })).toBe('feed reads nothing');
  });
});

describe('plitzi page check / what the page is not showing', () => {
  it('names an element with a condition of its own that has no node, or none the browser draws', () => {
    // jsdom lays nothing out: what the browser draws is said here, by a mark on the node.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) {
        return this.dataset.drawn === 'yes';
      }
    });
    document.body.innerHTML = `
      <div data-plitzi-el="shown" data-drawn="yes"></div>
      <div data-plitzi-el="folded"></div>
      <div data-plitzi-el="slot" style="display: contents"><p data-drawn="yes"></p></div>`;

    expect(notShownInPage(['shown', 'folded', 'slot', 'unmounted'].map(id => ({ id, selector: marked(id) })))).toEqual([
      'folded',
      'unmounted'
    ]);

    Reflect.deleteProperty(HTMLElement.prototype, 'checkVisibility');
  });
});

// Two classes set the same property: which one the page shows is the question an agent cannot answer from the code.
describe('the styles an element’s classes contest', () => {
  it('says the value shown, the class it comes from and what the others say — a shorthand’s longhands once', () => {
    const corner = (property: string) => ({
      property,
      declared: [
        { className: 'button-primary', value: '12px' },
        { className: 'ent-cta-pill', value: '999px' }
      ],
      shown: '999px',
      winner: 'ent-cta-pill'
    });

    expect(
      contestedText(
        [
          ...['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(at => corner(`border-${at}-radius`)),
          {
            property: 'color',
            declared: [
              { className: 'a', value: 'red' },
              { className: 'b', value: 'red' }
            ],
            shown: 'rgb(255, 0, 0)'
          }
        ],
        { 'button-primary': ['site-cta', 'write-cta'], 'ent-cta-pill': [], a: [], b: [] }
      )
    ).toEqual([
      'border-top-left-radius and 3 more like it: 999px, from ent-cta-pill (button-primary says 12px) — button-primary is also on site-cta, write-cta: changing the class itself changes them too',
      'color: rgb(255, 0, 0) — a and b all set it so; it stays rgb(255, 0, 0) without any one of them'
    ]);
  });

  // A class that shares one property may set others: only one whose every property stays is said to change nothing.
  it('says a class changes nothing only when every property it sets stays without it, and how far that was measured', () => {
    expect(inertText([{ className: 'ent-cta-pill', properties: 1 }], 1440, { 'ent-cta-pill': ['site-cta'] })).toEqual([
      'ent-cta-pill changes nothing on it at rest at 1440 px: each of the 1 property it sets stays as it is without it (a hover or another width may still need it). To drop it here, take it off this element’s `class`; ent-cta-pill is also on site-cta: changing the class itself changes it too.'
    ]);
  });
});

// A button whose flow does nothing looks like one that works, until it is clicked and every change is read off.
describe('what a click changed', () => {
  const moment = { url: '/enterprise', scrolls: { page: 3309 }, shown: ['footer', 'top'], said: [] };

  it('says where the page went, what scrolled, came and went, and the state', () => {
    expect(
      momentChanges(
        moment,
        { url: '/enterprise#plans', scrolls: { page: 0, faq: 120 }, shown: ['top', 'hero'], said: ['Link copied'] },
        { before: { menuOpen: false }, after: { menuOpen: true, faq: 'a' } }
      )
    ).toEqual([
      'went to /enterprise#plans (from /enterprise)',
      'the page scrolled 3309 → 0 px',
      'faq scrolled 0 → 120 px',
      'now shown: hero',
      'no longer shown: footer',
      'said: "Link copied"',
      'state.menuOpen: false → true',
      'state.faq: unset → "a"'
    ]);
  });

  it('says a click that changed nothing, in so many words', () => {
    expect(
      clickedText({ element: 'top', changes: momentChanges(moment, moment, { before: {}, after: {} }), failed: [] })
    ).toEqual([
      '  · clicking top changed nothing: no flow ran, the page went nowhere, nothing scrolled, appeared or went, nothing was said, and the state is as it was'
    ]);
  });

  it('says the fields it filled before the click', () => {
    expect(
      clickedText({
        element: 'send',
        filled: ['news-email = "ana@example.com"'],
        changes: ['state.newsSubscribed: unset → true'],
        failed: []
      })
    ).toEqual([
      '  · filled news-email = "ana@example.com"',
      '  · clicking send:',
      '      state.newsSubscribed: unset → true'
    ]);
  });
});

describe('the account a check signs in as', () => {
  const projectWith = async (env: string): Promise<string> => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-check-account-'));
    await fs.writeFile(path.join(root, '.env'), env);

    return root;
  };

  it('is the project’s own, from .env, and the one named over it', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\nPLITZI_CHECK_PASSWORD=inkwell\n');

    expect(await checkAccount(root)).toEqual({ username: 'carla', password: 'inkwell' });
    expect(await checkAccount(root, 'maya')).toEqual({ username: 'maya', password: 'inkwell' });
    await fs.rm(root, { recursive: true });
  });

  it('reads the environment over .env, as the project’s scripts do', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\nPLITZI_CHECK_PASSWORD=inkwell\n');
    vi.stubEnv('PLITZI_CHECK_PASSWORD', 'from-the-shell');

    expect(await checkAccount(root)).toEqual({ username: 'carla', password: 'from-the-shell' });
    vi.unstubAllEnvs();
    await fs.rm(root, { recursive: true });
  });

  it('is none when nothing names one, and says the password it lacks', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\n');

    const lacking = await checkAccount(root);

    expect(lacking && 'problem' in lacking ? lacking.problem : lacking).toContain(
      'carla signs in with the password in PLITZI_CHECK_PASSWORD: set it in .env'
    );
    await fs.writeFile(path.join(root, '.env'), '');
    expect(await checkAccount(root)).toBeUndefined();
    await fs.rm(root, { recursive: true });
  });
});

describe('the page an address is answered by', () => {
  const page = (id: string, path: string, slug = path.slice(1)) => ({ id, path, slug, elements: {} });
  const handles = {
    pages: {
      home: page('home', '/'),
      post: page('post', '/p/:slug'),
      lost: page('lost', '/*', '*'),
      docsLost: page('docsLost', '/docs/*', '*'),
      docs: page('docs', '/docs/intro', 'intro'),
      // A page of its own that answers a whole subtree: not a "not found" page.
      editor: page('editor', '/spaces/:spaceId/update/*')
    }
  } as unknown as Parameters<typeof pageFor>[0];

  it('is a page with a path of its own before any "not found" page — `/*` would answer `/` too', () => {
    expect(pageFor(handles, '/')).toBe('home');
    expect(pageFor(handles, '/p/hello')).toBe('post');
    expect(pageFor(handles, '/docs/intro')).toBe('docs');
  });

  it('is a page answering a subtree by its own `*`, never the "not found" page', () => {
    expect(pageFor(handles, '/spaces/7/update/pages/home')).toBe('editor');
  });

  it('is the deepest folder’s "not found" page, then the space’s', () => {
    expect(pageFor(handles, '/docs/nope')).toBe('docsLost');
    expect(pageFor(handles, '/nope/at/all')).toBe('lost');
  });
});
