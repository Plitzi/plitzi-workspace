import { describe, expect, it } from 'vitest';

import { createStore } from '@plitzi/nexus';

import { formatDuration, toRows } from './helpers';

import type { FreshnessGroup } from '../../../../../../scope/useFreshnessByStore';
import type { PathFreshness } from '@plitzi/nexus';

const group = (uid: string, name: string, records: Record<string, PathFreshness>): FreshnessGroup => ({
  entry: { uid, name, store: createStore<Record<string, unknown>>({}) },
  records
});

const labelOf = (entry: FreshnessGroup) => entry.entry.name ?? entry.entry.uid;

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
      [
        group('1', 'Queries', {
          'entries.b': { updatedAt: 0, expiresAt: 5_000 },
          'entries.a': { updatedAt: 1_000, expiresAt: 31_000 },
          forever: { updatedAt: 0, expiresAt: Infinity }
        })
      ],
      labelOf,
      10_000
    );

    expect(rows.map(({ path, isStale, age, status, ttl }) => ({ path, isStale, age, status, ttl }))).toEqual([
      { path: 'entries.a', isStale: false, age: '9s ago', status: '21s left', ttl: '30s' },
      { path: 'forever', isStale: false, age: '10s ago', status: 'no expiry', ttl: '∞' },
      { path: 'entries.b', isStale: true, age: '10s ago', status: 'stale', ttl: '5s' }
    ]);
  });

  it('lists every store, each row naming the store it belongs to', () => {
    const rows = toRows(
      [
        group('1', 'Queries', { 'entries.x': { updatedAt: 0, expiresAt: 60_000 } }),
        group('2', 'root', { 'entries.x': { updatedAt: 0, expiresAt: 60_000 } })
      ],
      labelOf,
      0
    );

    expect(rows.map(row => [row.key, row.storeLabel])).toEqual([
      ['1:entries.x', 'Queries'],
      ['2:entries.x', 'root']
    ]);
  });

  /** An answer that was never cacheable is written with no life; a clock read before the write called it current. */
  it('never reads a record as written after the clock', () => {
    const [row] = toRows([group('1', 'Queries', { 'entries.x': { updatedAt: 5_000, expiresAt: 5_000 } })], labelOf, 0);

    expect(row.age).toBe('0s ago');
    expect(row.status).toBe('stale');
  });

  it('shows what an opaque path stands for', () => {
    const [row] = toRows(
      [group('1', 'Queries', { 'entries.x': { updatedAt: 0, expiresAt: 60_000 } })],
      labelOf,
      0,
      () => ({ label: '/api/analytics', tags: ['an-api'] })
    );

    expect(row.label).toBe('/api/analytics');
    expect(row.tags).toEqual(['an-api']);
    expect(row.path).toBe('entries.x');
  });
});
