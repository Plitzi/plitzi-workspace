import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { differences, MEASURED, measuredText, measureOn, pairOf, sameProperties } from './measure';

import type { Measured } from './measure';

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
