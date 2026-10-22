import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { differences, MEASURED, measuredText, measureOn, sameProperties } from './measure';

import type { Measured } from './measure';

const measured = (styles: Record<string, string>, text = 'VS'): Measured => ({
  selector: '[data-plitzi-el="vs"]',
  tag: 'span',
  text,
  styles: Object.fromEntries(MEASURED.map(property => [property, styles[property] ?? 'normal']))
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
    expect(text).toContain('span "VS" here → span "VS" on https://www.example.com/combates');
    expect(text).toMatch(/≠ font-size\s+37\.6px {2}→ {2}44px/);
    expect(text).toContain('the same: font-family');
  });

  it('says an element that is not on the page, by the page it looked in', async () => {
    // A stand-in of a page: only its address and how many elements a selector finds are read before it is said missing.
    const page = {
      url: () => 'http://127.0.0.1:8080/combates',
      locator: () => ({ first: () => ({ count: () => Promise.resolve(0) }) })
    } as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(page, 'vs-medal')).toEqual({ problem: 'vs-medal is not on http://127.0.0.1:8080/combates' });
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
});
