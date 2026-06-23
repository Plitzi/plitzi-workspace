import { onScopeDispose, shallowRef } from 'vue';

import type { EntityId } from '../entities/createEntityAdapter';
import type { EntityStore } from '../entities/createEntityStore';
import type { Ref } from 'vue';

// Reactive view of a single entity by id; updates only when that entity changes, never for a sibling.
export function useEntityOne<T>(store: EntityStore<T>, id: EntityId): Ref<T | undefined> {
  const key = String(id);
  const value = shallowRef(store.getOne(key));
  onScopeDispose(
    store.subscribeOne(key, () => {
      value.value = store.getOne(key);
    })
  );

  return value;
}

// Reactive view of the id set; updates only on add/remove, not on a value change.
export function useEntityIds<T>(store: EntityStore<T>): Ref<string[]> {
  const value = shallowRef(store.getIds());
  onScopeDispose(
    store.subscribeIds(() => {
      value.value = store.getIds();
    })
  );

  return value;
}

// Reactive view of the whole collection; updates on any change. Prefer `useEntityIds` + per-row `useEntityOne`.
export function useEntityAll<T>(store: EntityStore<T>): Ref<T[]> {
  const value = shallowRef(store.getAll());
  onScopeDispose(
    store.subscribeAll(() => {
      value.value = store.getAll();
    })
  );

  return value;
}

// Ergonomic adapter binding an entity store to Vue: `const { useOne, useIds, useAll } = useEntity(store)`.
export function useEntity<T>(store: EntityStore<T>) {
  return {
    useOne: (id: EntityId) => useEntityOne(store, id),
    useIds: () => useEntityIds(store),
    useAll: () => useEntityAll(store)
  };
}
