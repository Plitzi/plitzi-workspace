import { afterEach, describe, expect, it } from 'vitest';

import { formatDate, formatDateUTC, formatUTCToLocal } from './formatDate';

const originalTimeZone = process.env.TZ;

const inTimeZone = (timeZone: string) => {
  process.env.TZ = timeZone;
};

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

describe('formatDateUTC', () => {
  it.each(['UTC', 'Europe/Madrid', 'America/Santiago', 'Asia/Kolkata', 'Pacific/Chatham'])(
    'prints the UTC wall clock whatever the local time zone is (%s)',
    timeZone => {
      inTimeZone(timeZone);

      expect(formatDateUTC('2024-03-31T01:30:00Z', 'yyyy-MM-dd HH:mm')).toBe('2024-03-31 01:30');
      expect(formatDateUTC(Date.UTC(2024, 11, 31, 23, 59, 59), 'dd MMMM yyyy HH:mm:ss', 'es')).toBe(
        '31 diciembre 2024 23:59:59'
      );
    }
  );

  it('keeps a year below 100 as that year', () => {
    inTimeZone('Europe/Madrid');
    const date = new Date(Date.UTC(2000, 5, 1, 12));
    date.setUTCFullYear(50);

    expect(formatDateUTC(date, 'yyyy-MM-dd HH:mm')).toBe('0050-06-01 12:00');
  });

  it('reads a number below 1e12 as seconds', () => {
    inTimeZone('America/Santiago');

    expect(formatDateUTC(1700000000, 'yyyy-MM-dd HH:mm')).toBe('2023-11-14 22:13');
  });
});

describe('formatUTCToLocal', () => {
  it('prints the local wall clock of the instant', () => {
    inTimeZone('Asia/Kolkata');

    expect(formatUTCToLocal('2024-01-15T10:00:00Z', 'yyyy-MM-dd HH:mm')).toBe('2024-01-15 15:30');
  });

  it('prints both passes of the hour that repeats when daylight saving time ends', () => {
    inTimeZone('Europe/Madrid');

    expect(formatUTCToLocal('2024-10-27T00:30:00Z', 'HH:mm xxx')).toBe('02:30 +02:00');
    expect(formatUTCToLocal('2024-10-27T01:30:00Z', 'HH:mm xxx')).toBe('02:30 +01:00');
  });

  it('matches formatDate, which formats in the local time zone too', () => {
    inTimeZone('America/Santiago');

    expect(formatUTCToLocal('2024-04-07T03:25:00Z')).toBe(formatDate('2024-04-07T03:25:00Z', 'dd MMMM, yyyy HH:mm'));
  });
});
