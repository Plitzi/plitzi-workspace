import { describe, expect, it } from 'vitest';

import timeLeftOf from './timeLeftOf';

describe('timeLeftOf', () => {
  it('counts hours while there are any, then minutes', () => {
    expect(timeLeftOf(24 * 3600)).toBe('24 h');
    expect(timeLeftOf(3600 + 59 * 60)).toBe('1 h');
    expect(timeLeftOf(3599)).toBe('60 min');
    expect(timeLeftOf(90)).toBe('2 min');
    expect(timeLeftOf(5)).toBe('1 min');
  });
});
