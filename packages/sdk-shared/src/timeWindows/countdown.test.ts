import { describe, expect, it } from 'vitest';

import {
  countdownDuration,
  countdownLabel,
  countdownParts,
  countdownTarget,
  countdownUnits,
  nextCountdownTick
} from './countdown';

import type { CountdownUnit } from './countdown';

const DEC_1 = Date.UTC(2026, 11, 1, 9);
const HOUR = 3_600_000;

const amounts = (now: number, largest?: CountdownUnit, smallest?: CountdownUnit) =>
  countdownParts(now, DEC_1, largest, smallest).map(part => part.amount);

describe('a countdown', () => {
  it('says what is left in each unit, the largest holding what does not fit below it', () => {
    const now = DEC_1 - (2 * 24 * HOUR + 3 * HOUR + 4 * 60_000 + 5_000);

    expect(amounts(now)).toEqual([2, 3, 4, 5]);
    expect(amounts(now, 'hours', 'minutes')).toEqual([51, 5]);
    expect(countdownParts(now, DEC_1, 'hours', 'minutes').map(part => part.unit)).toEqual(['hours', 'minutes']);
  });

  it('reads 1 in its last second, and 0 everywhere only once it is over', () => {
    expect(amounts(DEC_1 - 500)).toEqual([0, 0, 0, 1]);
    expect(amounts(DEC_1)).toEqual([0, 0, 0, 0]);
    expect(amounts(DEC_1 + HOUR)).toEqual([0, 0, 0, 0]);
  });

  it('takes its units largest first, and one alone when they are written the other way round', () => {
    expect(countdownUnits('days', 'seconds')).toEqual(['days', 'hours', 'minutes', 'seconds']);
    expect(countdownUnits('minutes', 'hours')).toEqual(['minutes']);
  });

  it('says when what it shows changes next, and nothing once over', () => {
    expect(nextCountdownTick(DEC_1 - 1500, DEC_1)).toBe(DEC_1 - 1000);
    expect(nextCountdownTick(DEC_1 - 90_000, DEC_1, 'minutes')).toBe(DEC_1 - 60_000);
    expect(nextCountdownTick(DEC_1, DEC_1)).toBeUndefined();
  });

  it('is an ISO duration for <time datetime>', () => {
    expect(countdownDuration(countdownParts(DEC_1 - (2 * 24 * HOUR + 4 * 60_000), DEC_1))).toBe('P2DT4M');
    expect(countdownDuration(countdownParts(DEC_1, DEC_1))).toBe('PT0S');
  });

  it('names its units in the page’s language and plural, English for a tag it does not know', () => {
    expect(countdownLabel('days', 2, 'long', 'en')).toBe('days');
    expect(countdownLabel('days', 1, 'long', 'en')).toBe('day');
    expect(countdownLabel('hours', 2, 'long', 'es')).toBe('horas');
    expect(countdownLabel('days', 2, 'long', 'not a tag')).toBe('days');
    expect(countdownLabel('days', 2, 'none', 'en')).toBe('');
  });

  it('counts to its own instant, or to the end of the window around it', () => {
    expect(countdownTarget('2026-12-01T09:00:00Z', '2027-01-01T00:00:00Z')).toBe(DEC_1);
    expect(countdownTarget('', '2026-12-01T09:00:00Z')).toBe(DEC_1);
    expect(countdownTarget('tomorrow', '2026-12-01T09:00:00Z')).toBeUndefined();
    expect(countdownTarget('', '')).toBeUndefined();
  });
});
