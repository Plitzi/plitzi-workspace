/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { describe, expect, it } from 'vitest';

import { processTwig } from '..';

/**
 * Twig's tests: `is defined`, `is empty`, and the rest.
 *
 * They used to be read as comparisons with a variable of that name — nobody sets one called `defined`, so
 * `x is defined` asked whether `x` was undefined, and answered true exactly when it was not defined. A template
 * telling "not loaded yet" from "loaded and empty" got the two backwards.
 */

const context = { list: [], rows: [1], record: {}, filled: { a: 1 }, zero: 0, text: '', nothing: null, four: 4 };

const render = (template: string) => processTwig(template, context);

describe('processTwig / tests', () => {
  it('tells defined from not', () => {
    expect(render("{{ list is defined ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ missing is defined ? 'y' : 'n' }}")).toBe('n');
    expect(render("{{ missing is not defined ? 'y' : 'n' }}")).toBe('y');
  });

  it('tells empty from not', () => {
    for (const name of ['list', 'record', 'text', 'nothing', 'missing']) {
      expect(render(`{{ ${name} is empty ? 'y' : 'n' }}`), name).toBe('y');
    }

    for (const name of ['rows', 'filled', 'zero', 'four']) {
      expect(render(`{{ ${name} is empty ? 'y' : 'n' }}`), name).toBe('n');
    }
  });

  it('tells null, iterable, even and odd', () => {
    expect(render("{{ nothing is null ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ zero is null ? 'y' : 'n' }}")).toBe('n');
    expect(render("{{ list is iterable ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ text is iterable ? 'y' : 'n' }}")).toBe('n');
    expect(render("{{ four is even ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ four is odd ? 'y' : 'n' }}")).toBe('n');
  });

  // What a test was needed for: loaded and empty is not the same as not loaded yet.
  it('tells an empty answer from no answer', () => {
    const template = "{{ data is defined and data is empty ? 'empty' : 'wait' }}";

    expect(processTwig(template, { data: [] })).toBe('empty');
    expect(processTwig(template, {})).toBe('wait');
    expect(processTwig(template, { data: [1] })).toBe('wait');
  });

  /**
   * `same as` is strict — `false` is not `'false'`, not `0`, and above all not a value that was never set. It used to
   * read `same` as a variable and compare with it, so an UNSET value was the one that matched.
   */
  it('tells a value strictly the same as another', () => {
    const flags = { off: false, word: 'false', zero: 0, one: 1, on: true, blank: null };
    const same = (template: string) => processTwig(template, flags);

    expect(same("{{ off is same as(false) ? 'y' : 'n' }}")).toBe('y');
    for (const name of ['word', 'zero', 'blank', 'missing', 'on']) {
      expect(same(`{{ ${name} is same as(false) ? 'y' : 'n' }}`), name).toBe('n');
    }

    expect(same("{{ missing is not same as(false) ? 'y' : 'n' }}")).toBe('y');
    expect(same("{{ one is same as(1) ? 'y' : 'n' }}")).toBe('y');
    expect(same("{{ one is same as('1') ? 'y' : 'n' }}")).toBe('n');
    expect(same("{{ blank is same as(null) ? 'y' : 'n' }}")).toBe('y');
  });

  it('reads the argument of same as as an expression', () => {
    expect(processTwig("{{ a is same as(b) ? 'y' : 'n' }}", { a: 3, b: 3 })).toBe('y');
    expect(processTwig("{{ a is same as(b + 1) ? 'y' : 'n' }}", { a: 4, b: 3 })).toBe('y');
    expect(processTwig("{{ a is same as (b) and c ? 'y' : 'n' }}", { a: 3, b: 3, c: false })).toBe('n');
  });

  it('tells a number divisible by another', () => {
    expect(render("{{ four is divisible by(2) ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ four is divisible by(3) ? 'y' : 'n' }}")).toBe('n');
    expect(render("{{ four is not divisible by(3) ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ zero is divisible by(5) ? 'y' : 'n' }}")).toBe('y');
    // By nothing, nothing is divisible — rather than NaN, which would be neither.
    expect(render("{{ four is divisible by(0) ? 'y' : 'n' }}")).toBe('n');
  });

  /** `null` and `none` are Twig's null — they were names nobody set, so `undefined`, and `same as(null)` never held. */
  it('reads null and none as null, and keeps is null a test', () => {
    const values = { blank: null, zero: 0 };

    expect(processTwig("{{ blank is same as(none) ? 'y' : 'n' }}", values)).toBe('y');
    expect(processTwig("{{ blank == null ? 'y' : 'n' }}", values)).toBe('y');
    expect(processTwig("{{ zero == null ? 'y' : 'n' }}", values)).toBe('n');
    // After `is`, `null` is still the test: an unset value is null as much as a null one is.
    expect(processTwig("{{ missing is null ? 'y' : 'n' }}", values)).toBe('y');
    expect(processTwig("{{ zero is not none ? 'y' : 'n' }}", values)).toBe('y');
    expect(processTwig("{{ missing ?? null ? 'y' : 'n' }}", values)).toBe('n');
  });

  it('keeps a variable called same a variable', () => {
    expect(processTwig("{{ a is same ? 'y' : 'n' }}", { a: 2, same: 2 })).toBe('y');
  });

  it('still compares against a value that is not a test', () => {
    expect(render("{{ four is 4 ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ four is not 5 ? 'y' : 'n' }}")).toBe('y');
  });
});
