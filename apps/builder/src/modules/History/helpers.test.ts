import { describe, expect, it } from 'vitest';

import {
  detailedEntries,
  formatValue,
  groupChanges,
  groupLines,
  groupRange,
  placeSnapshots,
  snapshotLabel
} from './helpers';

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

const snapshot = (revision: number, publishedAt: number, upToSeq: number | null = null): TSnapshotMarker => ({
  revision,
  environment: 'main',
  description: `v${revision}`,
  publishedAt,
  upToSeq
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

describe('placeSnapshots, by the change a revision reaches', () => {
  // Several saves in one second: only the change number says which of them the revision includes.
  it('draws a revision right above the last change it includes, whatever the clock says', () => {
    const groups = groupChanges([
      change(3, 1000, { client: 'a' }),
      change(2, 1000, { client: 'b' }),
      change(1, 1000, { client: 'c' })
    ]);

    const rows = placeSnapshots(groups, [snapshot(1, 1000, 2)], false).map(row =>
      row.type === 'group' ? `g${row.group.key}` : `r${row.snapshot.revision}`
    );

    expect(rows).toEqual(['g3', 'r1', 'g2', 'g1']);
  });
});

describe('labels', () => {
  it('says how far a revision reaches, or that it predates the history', () => {
    expect(snapshotLabel(snapshot(4, 0, 50))).toBe('Revision 4 · “v4” · includes up to #50');
    expect(snapshotLabel(snapshot(1, 0))).toBe('Revision 1 · “v1” · published before this history');
  });

  it('numbers a row by the changes it covers', () => {
    expect(groupRange({ key: '50', changes: [change(50, 2), change(48, 1)] })).toBe('#48–50');
    expect(groupRange({ key: '7', changes: [change(7, 1)] })).toBe('#7');
  });
});

describe('groupLines and the detail', () => {
  const added = change(2, 2, {
    entries: [
      {
        kind: 'element',
        id: 'hero',
        op: 'add',
        after: { definition: { type: 'text', parentId: 'test', items: [] } }
      },
      {
        kind: 'element',
        id: 'test',
        op: 'update',
        before: { definition: { type: 'page', parentId: null, items: [] } },
        after: { definition: { type: 'page', parentId: null, items: ['hero'] } }
      }
    ]
  });
  const typed = (seq: number, content: string) =>
    change(seq, seq, {
      entries: [
        {
          kind: 'element',
          id: 'hero',
          op: 'update',
          before: { attributes: { content: '' }, definition: { type: 'text' } },
          after: { attributes: { content }, definition: { type: 'text' } }
        }
      ]
    });

  it('says each thing once, a burst of typing included', () => {
    expect(groupLines({ key: '4', changes: [typed(4, 'Hel'), typed(3, 'He'), added] })).toEqual([
      'Changed content of text “hero”',
      'Added text “hero” to page “test”'
    ]);
  });

  // The page gained a child and nothing else: the line says so, and the detail does not list the page as changed.
  it('leaves an update that only moved the tree out of the detail', () => {
    expect(detailedEntries(added.entries).map(entry => entry.id)).toEqual(['hero']);
  });
});

describe('formatValue', () => {
  it('shows a value on one line, and cuts a long one', () => {
    expect(formatValue('Hi')).toBe('"Hi"');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue('x'.repeat(300))).toHaveLength(121);
  });
});
