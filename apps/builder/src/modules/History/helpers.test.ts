import { describe, expect, it } from 'vitest';

import { fieldChanges, formatValue, groupChanges, placeSnapshots } from './helpers';

import type { ChangeRecord } from './helpers';
import type { TSnapshotMarker } from '@plitzi/sdk-shared';

const change = (seq: number, at: number, overrides: Partial<ChangeRecord> = {}): ChangeRecord => ({
  seq,
  at,
  document: 'schema',
  author: { userId: 1, name: 'Ana' },
  origin: 'builder',
  client: 'tab-1',
  batch: `b-${seq}`,
  entries: [],
  summary: `change ${seq}`,
  ...overrides
});

const snapshot = (revision: number, publishedAt: number): TSnapshotMarker => ({
  revision,
  environment: 'main',
  description: `v${revision}`,
  publishedAt
});

describe('groupChanges', () => {
  it('reads a burst of saves by one person as one row, and splits on a pause or another author', () => {
    const groups = groupChanges([
      change(5, 200_000),
      change(4, 190_000),
      change(3, 100_000),
      change(2, 95_000, { origin: 'mcp', author: { userId: 1, name: 'Ana' } }),
      change(1, 94_000, { origin: 'mcp', author: { userId: 1, name: 'Ana' } })
    ]);

    expect(groups.map(group => group.changes.map(item => item.seq))).toEqual([[5, 4], [3], [2, 1]]);
  });

  it('keeps one request together however long it took', () => {
    const groups = groupChanges([change(2, 500_000, { batch: 'apply' }), change(1, 0, { batch: 'apply' })]);

    expect(groups).toHaveLength(1);
  });
});

describe('placeSnapshots', () => {
  it('draws a revision above the changes it includes, and an older one only once the timeline is over', () => {
    const groups = groupChanges([change(3, 300_000), change(2, 200_000, { client: 'tab-2' })]);
    const snapshots = [snapshot(2, 250_000), snapshot(1, 100_000)];

    const loading = placeSnapshots(groups, snapshots, false).map(row =>
      row.type === 'group' ? `g${row.group.key}` : `r${row.snapshot.revision}`
    );
    const complete = placeSnapshots(groups, snapshots, true).map(row =>
      row.type === 'group' ? `g${row.group.key}` : `r${row.snapshot.revision}`
    );

    expect(loading).toEqual(['g3', 'r2', 'g2']);
    expect(complete).toEqual(['g3', 'r2', 'g2', 'r1']);
  });
});

describe('fieldChanges', () => {
  it('names each field that changed inside an entity, and compares lists whole', () => {
    const before = { attributes: { content: 'Hi', href: '/a' }, definition: { items: ['a', 'b'] } };
    const after = { attributes: { content: 'Hello', href: '/a', title: 'T' }, definition: { items: ['b', 'a'] } };

    expect(fieldChanges(before, after)).toEqual([
      { path: 'attributes.content', before: 'Hi', after: 'Hello' },
      { path: 'attributes.title', after: 'T' },
      { path: 'definition.items', before: ['a', 'b'], after: ['b', 'a'] }
    ]);
  });
});

describe('formatValue', () => {
  it('shows a value on one line, and cuts a long one', () => {
    expect(formatValue('Hi')).toBe('"Hi"');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue('x'.repeat(300))).toHaveLength(121);
  });
});
