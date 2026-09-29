import { describe, expect, it } from 'vitest';

import idleDurationOf from './idleDurationOf';

describe('idleDurationOf', () => {
  it('says a duration in the largest unit it is a whole number of', () => {
    expect(idleDurationOf(7 * 24 * 60)).toBe('7 days');
    expect(idleDurationOf(24 * 60)).toBe('1 day');
    expect(idleDurationOf(36 * 60)).toBe('36 hours');
    expect(idleDurationOf(60)).toBe('1 hour');
    expect(idleDurationOf(90)).toBe('90 minutes');
    expect(idleDurationOf(1)).toBe('1 minute');
  });
});
