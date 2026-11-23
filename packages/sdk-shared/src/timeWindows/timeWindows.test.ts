import { describe, expect, it } from 'vitest';

import { instantOf, isWindowBound, isWindowOpen, nextWindowChange } from './timeWindows';

const DEC_1 = Date.UTC(2026, 11, 1, 9);
const DEC_8 = Date.UTC(2026, 11, 8, 9);

describe('a time window', () => {
  it('reads its bounds only as instants with their offset', () => {
    expect(instantOf('2026-12-01T09:00:00Z')).toBe(DEC_1);
    expect(instantOf('2026-12-01T10:00+01:00')).toBe(DEC_1);
    expect(instantOf('2026-12-01T09:00:00')).toBeUndefined();
    expect(instantOf('next monday')).toBeUndefined();
    expect(isWindowBound('')).toBe(true);
    expect(isWindowBound('2026-12-01 09:00')).toBe(false);
  });

  it('is open from its start up to its end, each left out meaning no bound', () => {
    const from = '2026-12-01T09:00:00Z';
    const until = '2026-12-08T09:00:00Z';

    expect(isWindowOpen(DEC_1 - 1, from, until)).toBe(false);
    expect(isWindowOpen(DEC_1, from, until)).toBe(true);
    expect(isWindowOpen(DEC_8, from, until)).toBe(false);
    expect(isWindowOpen(DEC_8, '', '')).toBe(true);
    expect(isWindowOpen(DEC_1 - 1, '', until)).toBe(true);
  });

  it('says the next instant it opens or closes at, and none once both are past', () => {
    expect(nextWindowChange(DEC_1 - 1, '2026-12-01T09:00:00Z', '2026-12-08T09:00:00Z')).toBe(DEC_1);
    expect(nextWindowChange(DEC_1, '2026-12-01T09:00:00Z', '2026-12-08T09:00:00Z')).toBe(DEC_8);
    expect(nextWindowChange(DEC_8, '2026-12-01T09:00:00Z', '2026-12-08T09:00:00Z')).toBeUndefined();
  });
});
