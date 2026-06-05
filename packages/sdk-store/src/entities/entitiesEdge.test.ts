import { describe, it, expect } from 'vitest';

import { createEntityAdapter } from './createEntityAdapter';

import type { EntityMap } from './createEntityAdapter';

type Item = { id: number; name: string; rank: number };

const items = (...list: Item[]): EntityMap<Item> => Object.fromEntries(list.map(item => [String(item.id), item]));

const a: Item = { id: 1, name: 'alpha', rank: 3 };
const b: Item = { id: 2, name: 'beta', rank: 1 };
const c: Item = { id: 3, name: 'gamma', rank: 2 };

describe('createEntityAdapter — edge cases', () => {
  it('returns the same map reference for no-op writes (so the store skips the change)', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a, b);

    expect(adapter.addOne(a)(map)).toBe(map); // id 1 already present → skipped
    expect(adapter.addMany([])(map)).toBe(map); // empty
    expect(adapter.upsertMany([])(map)).toBe(map); // empty
    expect(adapter.updateOne({ id: 99, changes: { name: 'x' } })(map)).toBe(map); // missing id
    expect(adapter.removeOne(99)(map)).toBe(map); // missing id
    expect(adapter.removeMany([99, 100])(map)).toBe(map); // none present
  });

  it('merges only existing entities in updateMany, skipping missing ids', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a, b);
    const next = adapter.updateMany([
      { id: 1, changes: { name: 'ALPHA' } },
      { id: 404, changes: { name: 'ghost' } }
    ])(map);

    expect(next['1'].name).toBe('ALPHA');
    expect(next['404']).toBeUndefined();
    expect(next['2']).toBe(b); // untouched entity shares its reference
  });

  it('upserts: inserts new and shallow-merges existing', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a);

    const inserted = adapter.upsertOne(b)(map);
    expect(inserted['2']).toEqual(b);

    const merged = adapter.upsertMany([{ id: 1, name: 'alpha2', rank: 3 }, c])(map);
    expect(merged['1'].name).toBe('alpha2');
    expect(merged['3']).toEqual(c);
  });

  it('setAll replaces the entire map', () => {
    const adapter = createEntityAdapter<Item>();
    const next = adapter.setAll([c])(items(a, b));

    expect(Object.keys(next)).toEqual(['3']);
  });

  it('removeMany drops only the present ids', () => {
    const adapter = createEntityAdapter<Item>();
    const next = adapter.removeMany([1, 99])(items(a, b, c));

    expect(Object.keys(next).sort()).toEqual(['2', '3']);
  });

  it('orders selectAll / selectIds by the sortComparer', () => {
    const adapter = createEntityAdapter<Item>({ sortComparer: (x, y) => x.rank - y.rank });
    const map = items(a, b, c);

    expect(adapter.selectAll(map).map(item => item.name)).toEqual(['beta', 'gamma', 'alpha']);
    expect(adapter.selectIds(map)).toEqual(['2', '3', '1']);
  });

  it('keeps insertion order for selectIds without a comparer (non-numeric ids)', () => {
    type Row = { id: string };
    const adapter = createEntityAdapter<Row>();
    const map = { gamma: { id: 'gamma' }, alpha: { id: 'alpha' }, beta: { id: 'beta' } };

    // Integer-like keys are reordered numerically by the JS engine, so insertion order only holds for string ids.
    expect(adapter.selectIds(map)).toEqual(['gamma', 'alpha', 'beta']);
  });

  it('supports a custom selectId', () => {
    type Row = { key: string; value: number };
    const adapter = createEntityAdapter<Row>({ selectId: row => row.key });
    const next = adapter.addOne({ key: 'k1', value: 1 })({});

    expect(next.k1).toEqual({ key: 'k1', value: 1 });
    expect(adapter.selectById(next, 'k1')?.value).toBe(1);
  });

  it('selectById / selectTotal handle a missing id and an empty map', () => {
    const adapter = createEntityAdapter<Item>();

    expect(adapter.selectById(items(a), 99)).toBeUndefined();
    expect(adapter.selectTotal({})).toBe(0);
    expect(adapter.selectAll({})).toEqual([]);
  });

  it('setAll with an empty array produces an empty map', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a, b);
    const next = adapter.setAll([])(map);

    expect(Object.keys(next)).toHaveLength(0);
  });

  it('removeOne from an empty map returns the same reference', () => {
    const adapter = createEntityAdapter<Item>();
    const map: EntityMap<Item> = {};

    expect(adapter.removeOne(1)(map)).toBe(map);
  });

  it('updateMany with all non-existing ids returns the same reference', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a);

    const next = adapter.updateMany([
      { id: 99, changes: { name: 'x' } },
      { id: 100, changes: { name: 'y' } }
    ])(map);

    expect(next).toBe(map);
  });

  it('addOne does not mutate the original map', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a, b);

    const next = adapter.addOne(c)(map);

    expect(Object.keys(map)).toHaveLength(2);
    expect(Object.keys(next)).toHaveLength(3);
    expect(map['3']).toBeUndefined();
    expect(next['3']).toEqual(c);
  });

  it('removeOne does not mutate the original map', () => {
    const adapter = createEntityAdapter<Item>();
    const map = items(a, b);

    const next = adapter.removeOne(1)(map);

    expect(Object.keys(map)).toHaveLength(2);
    expect(Object.keys(next)).toHaveLength(1);
  });
});
