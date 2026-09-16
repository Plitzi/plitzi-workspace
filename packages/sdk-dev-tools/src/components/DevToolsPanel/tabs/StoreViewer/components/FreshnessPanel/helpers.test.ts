import { describe, expect, it } from 'vitest';

import { formatDuration, toRows } from './helpers';

describe('formatDuration', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatDuration(900)).toBe('1s');
    expect(formatDuration(75_000)).toBe('1m 15s');
    expect(formatDuration(3_900_000)).toBe('1h 5m');
    expect(formatDuration(-5)).toBe('0s');
  });
});

describe('toRows', () => {
  it('says what is left of a current record and lists stale ones last', () => {
    const rows = toRows(
      {
        'entries.b': { updatedAt: 0, expiresAt: 5_000 },
        'entries.a': { updatedAt: 1_000, expiresAt: 31_000 },
        forever: { updatedAt: 0, expiresAt: Infinity }
      },
      10_000
    );

    expect(rows).toEqual([
      { path: 'entries.a', isStale: false, age: '9s ago', status: '21s left', ttl: '30s' },
      { path: 'forever', isStale: false, age: '10s ago', status: 'no expiry', ttl: '∞' },
      { path: 'entries.b', isStale: true, age: '10s ago', status: 'stale', ttl: '5s' }
    ]);
  });
});
