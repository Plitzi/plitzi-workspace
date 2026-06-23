import { useCallback, useSyncExternalStore } from 'react';

import type { EntityId } from '../../entities/createEntityAdapter';
import type { EntityStore } from '../../entities/createEntityStore';

// Subscribes to a single entity by id; re-renders only when that entity changes, never for a sibling.
export function useEntityOne<T>(store: EntityStore<T>, id: EntityId): T | undefined {
  const key = String(id);
  const subscribe = useCallback((listener: () => void) => store.subscribeOne(key, listener), [store, key]);
  const getSnapshot = useCallback(() => store.getOne(key), [store, key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Subscribes to the set of ids; re-renders only on add/remove, not on a value change.
export function useEntityIds<T>(store: EntityStore<T>): string[] {
  const subscribe = useCallback((listener: () => void) => store.subscribeIds(listener), [store]);
  const getIds = useCallback(() => store.getIds(), [store]);

  return useSyncExternalStore(subscribe, getIds, getIds);
}

// Subscribes to the whole collection; re-renders on any change. Prefer `useEntityIds` + per-row `useEntityOne`.
export function useEntityAll<T>(store: EntityStore<T>): T[] {
  const subscribe = useCallback((listener: () => void) => store.subscribeAll(listener), [store]);
  const getAll = useCallback(() => store.getAll(), [store]);

  return useSyncExternalStore(subscribe, getAll, getAll);
}

// Ergonomic adapter that binds an entity store to React, restoring the old `store.useOne/useIds/useAll` shape:
// `const { useOne, useIds, useAll } = useEntity(store)`.
export function useEntity<T>(store: EntityStore<T>) {
  return {
    useOne: (id: EntityId) => useEntityOne(store, id),
    useIds: () => useEntityIds(store),
    useAll: () => useEntityAll(store)
  };
}
