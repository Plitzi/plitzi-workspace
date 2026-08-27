import { describe, expect, it } from 'vitest';

import { cronMatches, isKnownTimeZone, parseCron } from './cron';

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

  /**
   * A zone is not an offset. "Nine in the morning in Santiago" is 12:00 UTC in July and 13:00 UTC in January,
   * because the zone moves and the schedule is supposed to follow it — which is the whole reason the trigger has
   * a field for one.
   */
  describe('in a named time zone', () => {
    const at = (iso: string) => new Date(iso);

    it('matches the wall clock there, on both sides of a DST change', () => {
      // 2026-07-15 is southern winter (UTC-4); 2026-01-15 is southern summer (UTC-3).
      expect(cronMatches('0 9 * * *', at('2026-07-15T13:00:00Z'), 'America/Santiago')).toBe(true);
      expect(cronMatches('0 9 * * *', at('2026-01-15T12:00:00Z'), 'America/Santiago')).toBe(true);

      expect(cronMatches('0 9 * * *', at('2026-07-15T12:00:00Z'), 'America/Santiago')).toBe(false);
      expect(cronMatches('0 9 * * *', at('2026-01-15T13:00:00Z'), 'America/Santiago')).toBe(false);
    });

    it('is UTC when no zone is named, exactly as before', () => {
      expect(cronMatches('0 9 * * *', at('2026-07-15T09:00:00Z'))).toBe(true);
      expect(cronMatches('0 9 * * *', at('2026-07-15T13:00:00Z'))).toBe(false);
    });

    /** The day and the weekday are the zone's too — an hour either side of midnight is a different date there. */
    it('reads the date in the zone, not in UTC', () => {
      // 23:30 on the 14th in Santiago is 03:30 on the 15th in UTC.
      expect(cronMatches('30 23 14 * *', at('2026-07-15T03:30:00Z'), 'America/Santiago')).toBe(true);
    });

    /** Never fires, rather than firing in UTC — a schedule at the wrong hour that says nothing is the bug. */
    it('matches nothing for a zone it does not know', () => {
      expect(cronMatches('* * * * *', at('2026-07-15T13:00:00Z'), 'Mars/Olympus')).toBe(false);
      expect(isKnownTimeZone('Mars/Olympus')).toBe(false);
      expect(isKnownTimeZone('Europe/Madrid')).toBe(true);
    });
  });
});
