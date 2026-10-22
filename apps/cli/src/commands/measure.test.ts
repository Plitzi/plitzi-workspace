import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { measuredText, measureOn, pairOf, putIn, sameProperties } from './measure';
import { differences, MEASURED } from './measureValues';

import type { Measured } from './measureValues';

const measured = (styles: Record<string, string>, text = 'VS'): Measured => ({
  selector: '[data-plitzi-el="vs"]',
  tag: 'span',
  text,
  styles: Object.fromEntries(MEASURED.map(property => [property, styles[property] ?? 'normal'])),
  inherited: []
});

// velada-polish's designers read the original's CSS by curl, and measured with scripts of their own, for each value.
describe('page measure', () => {
  it('says what differs, by property, here → there — and what is the same in a line', () => {
    const here = measured({ 'font-size': '37.6px', 'border-top': '2px solid rgb(199, 168, 107)' });
    const there = measured({ 'font-size': '44px', 'border-top': '1px solid rgb(199, 168, 107)' });

    expect(differences(here, there).differ).toEqual([
      { property: 'font-size', here: '37.6px', there: '44px' },
      { property: 'border-top', here: '2px solid rgb(199, 168, 107)', there: '1px solid rgb(199, 168, 107)' }
    ]);
    const text = stripVTControlCharacters(measuredText(here, there, 'https://www.example.com/combates'));
    expect(text).toContain(
      'span "VS" ([data-plitzi-el="vs"]) here → span "VS" ([data-plitzi-el="vs"]) on https://www.example.com/combates'
    );
    expect(text).toMatch(/≠ font-size\s+37\.6px {2}→ {2}44px/);
    expect(text).toContain('the same: font-family');
  });

  it('says an element that is not on the page, by the page it looked in', async () => {
    // A stand-in of a page: only its address and how many elements a selector finds are read before it is said missing.
    const page = {
      url: () => 'http://127.0.0.1:8080/combates',
      locator: () => ({ first: () => ({ count: () => Promise.resolve(0) }) })
    } as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(page, 'vs-medal')).toEqual({
      problem: expect.stringContaining('No element vs-medal on http://127.0.0.1:8080/combates — name it by') as unknown
    });
  });

  // velada-backlog: the medal's fill fades in on its card's hover — measured by hand, with a script of design-1's own.
  it('puts a page in the state asked before measuring — hovered or focused, its transitions waited for — or says why not', async () => {
    const acts: string[] = [];
    const stand = (count: number, act: () => Promise<void>) =>
      // A stand-in of a page: what putIn reads of one — its address, the element found, the state put, the wait.
      ({
        url: () => 'http://127.0.0.1:8080/combates',
        locator: () => ({
          first: () => ({
            count: () => Promise.resolve(count),
            hover: () => act().then(() => acts.push('hover')),
            focus: () => act().then(() => acts.push('focus'))
          })
        }),
        evaluate: () => Promise.resolve(acts.push('settled'))
      }) as unknown as Parameters<typeof putIn>[0];
    const state = { kind: 'hover' as const, pair: pairOf('fight-card => .fight-card') };

    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        state,
        'fight-card'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['hover', 'settled']);
    expect(
      await putIn(
        stand(0, () => Promise.resolve()),
        state,
        'fight-card'
      )
    ).toEqual({
      problem: 'No element fight-card to hover on http://127.0.0.1:8080/combates'
    });
    expect(
      await putIn(
        stand(1, () => Promise.reject(new Error('Timeout 5000ms exceeded.\n  waiting for…'))),
        { ...state, kind: 'focus' },
        'fight-card'
      )
    ).toEqual({
      problem: 'fight-card could not be focused on http://127.0.0.1:8080/combates: Timeout 5000ms exceeded.'
    });
  });

  // velada-backlog: design-1 measured `.home-faq-answer-text` — the element's id, written as a class — and was told
  // only "No element".
  it('says the other way to write a name the page has that way: an id without its dot, a class with one', async () => {
    const having = (...present: string[]) =>
      // A stand-in of a page: its address, and how many elements each selector finds.
      ({
        url: () => 'http://127.0.0.1:8080/',
        locator: (selector: string) => ({
          first: () => ({ count: () => Promise.resolve(present.includes(selector) ? 1 : 0) })
        })
      }) as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(having('[data-plitzi-el="home-faq-answer-text"]'), '.home-faq-answer-text')).toEqual({
      problem:
        "No element .home-faq-answer-text on http://127.0.0.1:8080/ — home-faq-answer-text is an element's id here: write it without the dot"
    });
    expect(await measureOn(having('.faq-answer-body'), 'faq-answer-body')).toEqual({
      problem:
        "No element faq-answer-body on http://127.0.0.1:8080/ — faq-answer-body is a class here, no element's id: write it .faq-answer-body"
    });
  });

  // velada-backlog: `body` on our side read Times 400 and the noscript's words — the space's type is on its root.
  it("says, of a document's body measured on a space's page, the root to measure instead", () => {
    const body = { ...measured({}, ''), tag: 'body', selector: 'body', spaceRoot: 'shell-root' };

    expect(stripVTControlCharacters(measuredText(body, measured({}, '')))).toContain(
      'body is the document\'s: the space dresses its root, shell-root — measure it, "shell-root => body"'
    );
  });

  // Preparing velada's next run: our footer's label, held still, read "color 1e-05s cubic-bezier(0.4, 0, 0.2, 1)" against
  // the original's 0.3s — a difference of nothing, said because the easing's own commas split the list.
  it('reads a transition held still as no difference, whatever commas its easing has', () => {
    const here = measured({ transition: 'color 1e-05s cubic-bezier(0.4, 0, 0.2, 1), opacity 0s ease' });
    const there = measured({ transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease' });
    const moving = measured({ transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0s ease' });

    expect(differences(here, there).differ.map(each => each.property)).not.toContain('transition');
    expect(
      differences(moving, measured({ transition: 'color 0.6s ease' })).differ.map(each => each.property)
    ).toContain('transition');
  });

  // velada-polish: the VS sizes in the acceptance were the lead's guess; a line that measures them proves them.
  it('takes the properties an acceptance holds to the other page, shorthands opened, and refuses what is not measured', () => {
    expect(sameProperties('font-size, border')).toEqual([
      'font-size',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left'
    ]);
    expect(sameProperties('font')).toContain('letter-spacing');
    expect(() => sameProperties('font-size,glow')).toThrow('not glow');
  });

  // velada's first measures: Cinzel with another fallback, borders of no width, one gold in two notations — noise.
  it('reads one look written two ways as the same: the font asked first, a side of no width, one colour', () => {
    const here = measured({
      'font-family': 'Cinzel, Georgia, serif',
      color: 'rgb(199, 168, 107)',
      'border-top': '0px solid rgb(244, 228, 201)',
      'font-size': '9.808px'
    });
    const there = measured({
      'font-family': '"Cinzel", "Cinzel Fallback", system-ui',
      color: 'color(srgb 0.780392 0.658824 0.419608)',
      'border-top': '0px solid color(srgb 0.8 0.69 0.47 / 0.88)',
      'font-size': '14.7536px'
    });

    expect(differences(here, there).differ.map(each => each.property)).toEqual(['font-size']);

    // Tailwind's oklab gold is the theme's gold.
    const tailwind = measured({
      'font-family': 'Cinzel',
      'background-color': 'oklab(0.745428 0.00989413 0.0865543 / 0.05)'
    });
    const ours = measured({
      'font-family': 'Cinzel',
      'background-color': 'color(srgb 0.780392 0.658824 0.419608 / 0.05)'
    });
    expect(differences(ours, tailwind).differ).toEqual([]);
  });

  // velada-fidelity: ~150 calls, one element a call — each ours and theirs, written in one argument.
  it('reads "ours => theirs" as one element asked on both pages, and a name alone as the same on both', () => {
    expect(pairOf('fight-card-vs => .vs-medal')).toEqual({ here: 'fight-card-vs', there: '.vs-medal' });
    expect(pairOf('[data-plitzi-el="a"] > span=>.b span')).toEqual({
      here: '[data-plitzi-el="a"] > span',
      there: '.b span'
    });
    expect(pairOf('fight-card-vs')).toEqual({ here: 'fight-card-vs', there: 'fight-card-vs' });
  });

  // velada-fidelity: the VS medal's fill is on ::before — read as no fill, and the plan asked it away.
  it('compares what a box draws on ::before, and holds --same to it', () => {
    const here = { ...measured({}), styles: { ...measured({}).styles } };
    const there = {
      ...measured({}),
      styles: {
        ...measured({}).styles,
        'before:background-image': 'radial-gradient(circle, gold, black)',
        'before:opacity': '0.6'
      }
    };

    expect(differences(here, there).differ).toEqual(
      expect.arrayContaining([
        { property: 'before:background-image', here: 'none', there: 'radial-gradient(circle, gold, black)' },
        { property: 'before:opacity', here: 'none', there: '0.6' }
      ])
    );
    expect(sameProperties('before:background-image,after:opacity')).toEqual([
      'before:background-image',
      'after:opacity'
    ]);
    expect(() => sameProperties('before:glow')).toThrow('not before:glow');
  });

  // velada-fidelity: every element listed the page's font as differing, burying what the element itself does.
  it('says what both inherit from their parent apart, once, after what the element itself does differently', () => {
    const here = { ...measured({ 'font-family': 'system-ui', 'font-size': '12px' }), inherited: ['font-family'] };
    const there = { ...measured({ 'font-family': 'Cinzel', 'font-size': '14px' }), inherited: ['font-family'] };

    expect(differences(here, there).differ).toEqual([
      { property: 'font-family', here: 'system-ui', there: 'Cinzel', inherited: true },
      { property: 'font-size', here: '12px', there: '14px' }
    ]);
    const text = stripVTControlCharacters(measuredText(here, there));
    expect(text).toMatch(/≠ font-size/);
    expect(text).not.toMatch(/≠ font-family/);
    expect(text).toContain('≈ inherited from its parent on both pages, differs: font-family system-ui → cinzel');
  });
});
