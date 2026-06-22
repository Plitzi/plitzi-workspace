import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { createEntityStore } from './createEntityStore';
import { useEntityOne, useEntityIds, useEntityAll } from '../react/hooks/useEntity';

type Item = { id: string; value: number; tag?: string };

const seed = (): Item[] => [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
  { id: 'c', value: 3 }
];

describe('createEntityStore — reads and writes', () => {
  it('seeds from the initial list and reads by id', () => {
    const store = createEntityStore<Item>(seed());

    expect(store.size()).toBe(3);
    expect(store.getOne('b')).toEqual({ id: 'b', value: 2 });
    expect(store.getIds()).toEqual(['a', 'b', 'c']);
    expect(store.has('z')).toBe(false);
  });

  it('setOne replaces, addOne skips existing, upsertOne merges', () => {
    const store = createEntityStore<Item>(seed());

    store.setOne({ id: 'a', value: 10 });
    expect(store.getOne('a')).toEqual({ id: 'a', value: 10 });

    store.addOne({ id: 'a', value: 999 });
    expect(store.getOne('a')).toEqual({ id: 'a', value: 10 });

    store.upsertOne({ id: 'a', tag: 'x' } as Item);
    expect(store.getOne('a')).toEqual({ id: 'a', value: 10, tag: 'x' });
  });

  it('updateOne merges changes and is a no-op for an absent id', () => {
    const store = createEntityStore<Item>(seed());

    store.updateOne('b', { value: 20 });
    expect(store.getOne('b')).toEqual({ id: 'b', value: 20 });

    store.updateOne('missing', { value: 1 });
    expect(store.has('missing')).toBe(false);
  });

  it('removeOne / removeMany / removeAll drop entities', () => {
    const store = createEntityStore<Item>(seed());

    store.removeOne('a');
    expect(store.getIds()).toEqual(['b', 'c']);

    store.removeMany(['b', 'z']);
    expect(store.getIds()).toEqual(['c']);

    store.removeAll();
    expect(store.size()).toBe(0);
  });

  it('setAll replaces the whole collection', () => {
    const store = createEntityStore<Item>(seed());

    store.setAll([{ id: 'x', value: 9 }]);
    expect(store.getIds()).toEqual(['x']);
  });
});

describe('createEntityStore — per-id reactivity', () => {
  it('a single-item write wakes only that id, not siblings', () => {
    const store = createEntityStore<Item>(seed());
    const onA = vi.fn();
    const onB = vi.fn();
    store.subscribeOne('a', onA);
    store.subscribeOne('b', onB);

    store.updateOne('a', { value: 100 });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });

  it('does not wake when the written value is referentially identical', () => {
    const same = { id: 'a', value: 1 };
    const store = createEntityStore<Item>([same]);
    const onA = vi.fn();
    store.subscribeOne('a', onA);

    store.setOne(same);

    expect(onA).not.toHaveBeenCalled();
  });

  it('subscribeIds wakes on add/remove but not on a value change', () => {
    const store = createEntityStore<Item>(seed());
    const onIds = vi.fn();
    store.subscribeIds(onIds);

    store.updateOne('a', { value: 100 });
    expect(onIds).not.toHaveBeenCalled();

    store.addOne({ id: 'd', value: 4 });
    expect(onIds).toHaveBeenCalledTimes(1);

    store.removeOne('d');
    expect(onIds).toHaveBeenCalledTimes(2);
  });

  it('subscribeAll wakes on any change', () => {
    const store = createEntityStore<Item>(seed());
    const onAll = vi.fn();
    store.subscribeAll(onAll);

    store.updateOne('a', { value: 100 });
    store.addOne({ id: 'd', value: 4 });

    expect(onAll).toHaveBeenCalledTimes(2);
  });

  it('unsubscribing stops wakes and cleans up the id listener slot', () => {
    const store = createEntityStore<Item>(seed());
    const onA = vi.fn();
    const off = store.subscribeOne('a', onA);

    off();
    store.updateOne('a', { value: 100 });

    expect(onA).not.toHaveBeenCalled();
  });
});

describe('createEntityStore — batch', () => {
  it('coalesces wakes: each touched id once, id-set once, all once', () => {
    const store = createEntityStore<Item>(seed());
    const onA = vi.fn();
    const onIds = vi.fn();
    const onAll = vi.fn();
    store.subscribeOne('a', onA);
    store.subscribeIds(onIds);
    store.subscribeAll(onAll);

    store.batch(() => {
      store.updateOne('a', { value: 10 });
      store.updateOne('a', { value: 20 });
      store.addOne({ id: 'd', value: 4 });
    });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onIds).toHaveBeenCalledTimes(1);
    expect(onAll).toHaveBeenCalledTimes(1);
    expect(store.getOne('a')).toEqual({ id: 'a', value: 20 });
  });

  it('many-ops are batched internally', () => {
    const store = createEntityStore<Item>(seed());
    const onAll = vi.fn();
    store.subscribeAll(onAll);

    store.updateMany([
      { id: 'a', changes: { value: 10 } },
      { id: 'b', changes: { value: 20 } }
    ]);

    expect(onAll).toHaveBeenCalledTimes(1);
  });
});

describe('createEntityStore — snapshot stability', () => {
  it('getAll/getIds return a stable reference until a relevant change', () => {
    const store = createEntityStore<Item>(seed());

    const ids1 = store.getIds();
    const all1 = store.getAll();
    expect(store.getIds()).toBe(ids1);
    expect(store.getAll()).toBe(all1);

    store.updateOne('a', { value: 100 });
    expect(store.getIds()).toBe(ids1); // id-set unchanged → same ids ref
    expect(store.getAll()).not.toBe(all1); // a value changed → new all ref

    const ids2 = store.getIds();
    store.addOne({ id: 'd', value: 4 });
    expect(store.getIds()).not.toBe(ids2); // id-set changed → new ids ref
  });

  it('applies sortComparer to getAll', () => {
    const store = createEntityStore<Item>(seed(), { sortComparer: (a, b) => b.value - a.value });

    expect(store.getAll().map(item => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('supports a custom selectId', () => {
    type Row = { key: number; name: string };
    const store = createEntityStore<Row>([{ key: 7, name: 'seven' }], { selectId: row => row.key });

    expect(store.getOne(7)).toEqual({ key: 7, name: 'seven' });
  });
});

describe('createEntityStore — React hooks', () => {
  it('useEntity re-renders only when its own id changes', () => {
    const store = createEntityStore<Item>(seed());
    let aRenders = 0;
    let bRenders = 0;

    const a = renderHook(() => {
      aRenders++;

      return useEntityOne(store, 'a');
    });
    renderHook(() => {
      bRenders++;

      return useEntityOne(store, 'b');
    });

    const aBaseline = aRenders;
    const bBaseline = bRenders;

    act(() => store.updateOne('a', { value: 100 }));

    expect(a.result.current).toEqual({ id: 'a', value: 100 });
    expect(aRenders).toBe(aBaseline + 1);
    expect(bRenders).toBe(bBaseline); // sibling did not re-render
  });

  it('useEntityIds re-renders on add/remove, not on a value change', () => {
    const store = createEntityStore<Item>(seed());
    let renders = 0;

    const { result } = renderHook(() => {
      renders++;

      return useEntityIds(store);
    });

    const baseline = renders;
    act(() => store.updateOne('a', { value: 100 }));
    expect(renders).toBe(baseline); // value change → no id-set re-render

    act(() => store.addOne({ id: 'd', value: 4 }));
    expect(renders).toBe(baseline + 1);
    expect(result.current).toEqual(['a', 'b', 'c', 'd']);
  });

  it('useEntities re-renders on any change', () => {
    const store = createEntityStore<Item>(seed());

    const { result } = renderHook(() => useEntityAll(store));

    act(() => store.updateOne('a', { value: 100 }));
    expect(result.current.find(item => item.id === 'a')).toEqual({ id: 'a', value: 100 });
  });
});

describe('createEntityStore — destroy', () => {
  it('clears entities and listeners', () => {
    const store = createEntityStore<Item>(seed());
    const onA = vi.fn();
    store.subscribeOne('a', onA);

    store.destroy();
    expect(store.size()).toBe(0);

    store.setOne({ id: 'a', value: 1 });
    expect(onA).not.toHaveBeenCalled();
  });
});
