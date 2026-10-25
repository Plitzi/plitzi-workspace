import { describe, expect, it } from 'vitest';

import { FILTER_DOCS, FUNCTION_DOCS } from '.';
import { processTwig } from '../..';
import { filters } from '../filters';

describe('the template filters, documented', () => {
  it('documents every filter there is, and none there is not', () => {
    expect(Object.keys(FILTER_DOCS).sort()).toEqual(Object.keys(filters).sort());
  });

  it('reads “now” as the moment the page is rendered', () => {
    const year = String(new Date().getUTCFullYear());

    expect(filters.date('now', ['Y', 'UTC'])).toBe(year);
  });

  // `plitzi explain max` answered nothing — a function was known only to the evaluator and the check.
  it('documents the functions the evaluator implements: each one answers', () => {
    expect(processTwig('{{ max(2, 7, 3) }}', {})).toBe('7');
    expect(processTwig('{{ min(2, 7, 3) }}', {})).toBe('2');
    expect(processTwig("{{ cycle(['a', 'b'], 3) }}", {})).toBe('b');
    expect(processTwig('{{ range(1, 3)|join(",") }}', {})).toBe('1,2,3');
    expect(Object.keys(FUNCTION_DOCS).sort()).toEqual(['cycle', 'max', 'min', 'range']);
  });
});
