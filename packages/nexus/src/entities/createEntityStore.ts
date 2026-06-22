import Subscribers from '../createStore/helpers/Subscribers';

import type { EntityId } from './createEntityAdapter';

export type EntityChangeListener = () => void;

export type EntityStoreOptions<T> = {
  // How to read an entity's id. Defaults to `entity.id`.
  selectId?: (entity: T) => EntityId;
  // Orders `getAll`/`getIds`. Omit to keep insertion order.
  sortComparer?: (a: T, b: T) => number;
};

// A reactive normalized collection: a `Map<id, entity>` with per-id subscriptions, so a single-item write wakes only
// that item's watchers in O(1) instead of copying the whole map and diffing every path (the cost an immutable tree
// pays on `setState('items.<id>...')`). It is nexus's answer to the atom/proxy stores' O(1) entity updates, kept as a
// standalone primitive so it coexists with `createStore` rather than changing the tree's write model.
//
// Change detection is by per-id notification, not reference identity: values are *replaced* (never mutated in place),
// so a consumer holding an old entity reference stays valid, while the live `Map` is never handed out — reads return
// cached snapshot arrays that stay referentially stable between changes for `useSyncExternalStore`.
//
// This is the framework-agnostic primitive: it exposes `getOne/getAll/getIds` + `subscribe*` only. React bindings
// (`useEntity` / `useEntityOne` / `useEntityIds` / `useEntityAll`) live in `@plitzi/nexus/react` and ride on these.
export type EntityStore<T> = {
  selectId: (entity: T) => EntityId;

  getOne: (id: EntityId) => T | undefined;
  getAll: () => T[];
  getIds: () => string[];
  has: (id: EntityId) => boolean;
  size: () => number;

  setOne: (entity: T) => void;
  setMany: (entities: readonly T[]) => void;
  setAll: (entities: readonly T[]) => void;
  addOne: (entity: T) => void;
  addMany: (entities: readonly T[]) => void;
  upsertOne: (entity: T) => void;
  upsertMany: (entities: readonly T[]) => void;
  updateOne: (id: EntityId, changes: Partial<T>) => void;
  updateMany: (updates: readonly { id: EntityId; changes: Partial<T> }[]) => void;
  removeOne: (id: EntityId) => void;
  removeMany: (ids: readonly EntityId[]) => void;
  removeAll: () => void;

  // Coalesces every write inside `fn`: each touched id wakes once, the id-set and the whole-collection watchers wake
  // once, after `fn` returns.
  batch: (fn: () => void) => void;

  // Wakes when the entity at `id` is set, updated, or removed.
  subscribeOne: (id: EntityId, listener: EntityChangeListener) => () => void;
  // Wakes when the set of ids changes (an id is added or removed), not when an existing entity's value changes.
  subscribeIds: (listener: EntityChangeListener) => () => void;
  // Wakes on any change to any entity.
  subscribeAll: (listener: EntityChangeListener) => () => void;

  destroy: () => void;
};

export function createEntityStore<T>(
  initialEntities: readonly T[] = [],
  options: EntityStoreOptions<T> = {}
): EntityStore<T> {
  const selectId = options.selectId ?? ((entity: T) => (entity as { id: EntityId }).id);
  const sortComparer = options.sortComparer;
  const keyOf = (entity: T): string => String(selectId(entity));

  const entities = new Map<string, T>();
  for (const entity of initialEntities) {
    entities.set(keyOf(entity), entity);
  }

  const idListeners = new Map<string, Subscribers<EntityChangeListener>>();
  const idsListeners = new Subscribers<EntityChangeListener>();
  const allListeners = new Subscribers<EntityChangeListener>();

  // Snapshot caches keep `useSyncExternalStore` reads referentially stable: `idsSnapshot` drops only when the id-set
  // changes, `allSnapshot` drops on any change.
  let idsSnapshot: string[] | undefined;
  let allSnapshot: T[] | undefined;

  // Batch buffering: while `batchDepth > 0`, wakes are recorded and fired once at the end. The empty-set checks keep
  // the un-batched single-write path free of allocation.
  let batchDepth = 0;
  const pendingIds = new Set<string>();
  let pendingIdsChanged = false;
  let pendingAny = false;

  const wake = (subs: Subscribers<EntityChangeListener> | undefined): void => {
    if (subs && subs.length > 0) {
      subs.forEach(listener => listener());
    }
  };

  // Marks the entity at `key` changed. `idSetChanged` is true when the id was added or removed (so the id-set and the
  // `getIds` snapshot are affected too).
  const touch = (key: string, idSetChanged: boolean): void => {
    if (idSetChanged) {
      idsSnapshot = undefined;
    }

    allSnapshot = undefined;

    if (batchDepth > 0) {
      pendingIds.add(key);
      pendingIdsChanged = pendingIdsChanged || idSetChanged;
      pendingAny = true;

      return;
    }

    wake(idListeners.get(key));
    if (idSetChanged) {
      wake(idsListeners);
    }

    wake(allListeners);
  };

  const flush = (): void => {
    const ids = [...pendingIds];
    const idsChanged = pendingIdsChanged;
    const any = pendingAny;
    pendingIds.clear();
    pendingIdsChanged = false;
    pendingAny = false;

    for (const key of ids) {
      wake(idListeners.get(key));
    }

    if (idsChanged) {
      wake(idsListeners);
    }

    if (any) {
      wake(allListeners);
    }
  };

  const batch = (fn: () => void): void => {
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && pendingAny) {
        flush();
      }
    }
  };

  const writeOne = (entity: T, skipExisting: boolean, merge: boolean): void => {
    const key = keyOf(entity);
    const existing = entities.get(key);
    const isNew = existing === undefined;
    if (skipExisting && !isNew) {
      return;
    }

    const next = merge && !isNew ? { ...existing, ...entity } : entity;
    if (next === existing) {
      return;
    }

    entities.set(key, next);
    touch(key, isNew);
  };

  const setOne = (entity: T): void => {
    writeOne(entity, false, false);
  };

  const addOne = (entity: T): void => {
    writeOne(entity, true, false);
  };

  const upsertOne = (entity: T): void => {
    writeOne(entity, false, true);
  };

  const updateOne = (id: EntityId, changes: Partial<T>): void => {
    const key = String(id);
    const existing = entities.get(key);
    if (existing === undefined) {
      return;
    }

    entities.set(key, { ...existing, ...changes });
    touch(key, false);
  };

  const removeOne = (id: EntityId): void => {
    const key = String(id);
    if (!entities.has(key)) {
      return;
    }

    entities.delete(key);
    touch(key, true);
  };

  const getOne = (id: EntityId): T | undefined => entities.get(String(id));
  const getIds = (): string[] => (idsSnapshot ??= [...entities.keys()]);
  const getAll = (): T[] => {
    if (allSnapshot === undefined) {
      const all = [...entities.values()];
      allSnapshot = sortComparer ? all.sort(sortComparer) : all;
    }

    return allSnapshot;
  };

  const subscribeOne = (id: EntityId, listener: EntityChangeListener): (() => void) => {
    const key = String(id);
    let subs = idListeners.get(key);
    if (!subs) {
      subs = new Subscribers<EntityChangeListener>();
      idListeners.set(key, subs);
    }

    const ownSubs = subs;
    const unsubscribe = ownSubs.add(listener);

    return () => {
      unsubscribe();
      if (ownSubs.length === 0 && idListeners.get(key) === ownSubs) {
        idListeners.delete(key);
      }
    };
  };

  const subscribeIds = (listener: EntityChangeListener): (() => void) => idsListeners.add(listener);
  const subscribeAll = (listener: EntityChangeListener): (() => void) => allListeners.add(listener);

  return {
    selectId,

    getOne,
    getIds,
    getAll,
    has: id => entities.has(String(id)),
    size: () => entities.size,

    setOne,
    setMany: list => batch(() => list.forEach(setOne)),
    setAll: list =>
      batch(() => {
        for (const key of [...entities.keys()]) {
          removeOne(key);
        }

        list.forEach(setOne);
      }),
    addOne,
    addMany: list => batch(() => list.forEach(addOne)),
    upsertOne,
    upsertMany: list => batch(() => list.forEach(upsertOne)),
    updateOne,
    updateMany: updates => batch(() => updates.forEach(({ id, changes }) => updateOne(id, changes))),
    removeOne,
    removeMany: ids => batch(() => ids.forEach(removeOne)),
    removeAll: () => batch(() => [...entities.keys()].forEach(removeOne)),

    batch,

    subscribeOne,
    subscribeIds,
    subscribeAll,

    destroy: () => {
      entities.clear();
      idListeners.clear();
      idsListeners.clear();
      allListeners.clear();
      idsSnapshot = undefined;
      allSnapshot = undefined;
    }
  };
}
