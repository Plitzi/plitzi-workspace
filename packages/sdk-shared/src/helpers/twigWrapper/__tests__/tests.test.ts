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

  it('still compares against a value that is not a test', () => {
    expect(render("{{ four is 4 ? 'y' : 'n' }}")).toBe('y');
    expect(render("{{ four is not 5 ? 'y' : 'n' }}")).toBe('y');
  });
});
