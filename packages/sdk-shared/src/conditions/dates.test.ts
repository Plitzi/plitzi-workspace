import { describe, expect, it } from 'vitest';

import { isDate } from './dates';

/** What the rule evaluator treats as a date: a real calendar day written `YYYY-MM-DD`, and nothing else. */
describe('conditions/isDate', () => {
  it('accepts a real day in the shape it asks for', () => {
    expect(isDate('2024-02-29')).toBe(true);
    expect(isDate('0099-01-01')).toBe(true);
  });

  /** The shape alone is not a day: a date that rolls over into the next month is not the one that was written. */
  it('refuses a day the calendar does not have', () => {
    expect(isDate('2023-02-29')).toBe(false);
    expect(isDate('2024-02-30')).toBe(false);
    expect(isDate('2024-13-01')).toBe(false);
  });

  it('refuses anything that is not that shape', () => {
    expect(isDate('2024-2-1')).toBe(false);
    expect(isDate('01/02/2024')).toBe(false);
    expect(isDate(20240101)).toBe(false);
  });
});
