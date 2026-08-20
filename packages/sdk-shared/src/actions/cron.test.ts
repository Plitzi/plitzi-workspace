import { describe, expect, it } from 'vitest';

import { cronMatches, parseCron } from './cron';

const at = (iso: string) => new Date(iso);

describe('cron', () => {
  it('reads the vocabulary people write', () => {
    expect(cronMatches('* * * * *', at('2026-08-20T10:30:00Z'))).toBe(true);
    expect(cronMatches('30 10 * * *', at('2026-08-20T10:30:00Z'))).toBe(true);
    expect(cronMatches('30 10 * * *', at('2026-08-20T11:30:00Z'))).toBe(false);
    expect(cronMatches('*/15 * * * *', at('2026-08-20T10:45:00Z'))).toBe(true);
    expect(cronMatches('*/15 * * * *', at('2026-08-20T10:46:00Z'))).toBe(false);
    expect(cronMatches('0 9-17 * * 1-5', at('2026-08-20T09:00:00Z'))).toBe(true);
  });

  // Every cron does this and it surprises everyone: with both day fields restricted, the two are OR'd.
  it('ORs day-of-month with day-of-week when both are restricted', () => {
    // 2026-08-01 is a Saturday; 2026-08-03 a Monday.
    expect(cronMatches('0 0 1 * 1', at('2026-08-01T00:00:00Z'))).toBe(true);
    expect(cronMatches('0 0 1 * 1', at('2026-08-03T00:00:00Z'))).toBe(true);
    expect(cronMatches('0 0 1 * 1', at('2026-08-04T00:00:00Z'))).toBe(false);
  });

  it('refuses an expression it does not understand instead of firing at random', () => {
    expect(parseCron('@daily')).toBeUndefined();
    expect(parseCron('0 0 * *')).toBeUndefined();
    expect(parseCron('99 * * * *')).toBeUndefined();
    expect(cronMatches('nonsense', at('2026-08-20T10:30:00Z'))).toBe(false);
  });
});
