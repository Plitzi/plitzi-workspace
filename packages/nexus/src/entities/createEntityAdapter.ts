export type EntityId = string | number;
export type EntityMap<T> = Record<string, T>;
export type EntityUpdate<T> = { id: EntityId; changes: Partial<T> };

// An updater for a normalized map, ready to hand to `setState(path, updater)`. Returns the same map reference when
// nothing changed, so the store skips the write and the notification.
export type EntityUpdater<T> = (map: EntityMap<T>) => EntityMap<T>;

export type EntityAdapter<T> = {
  getInitialState: () => EntityMap<T>;
  selectId: (entity: T) => EntityId;

  addOne: (entity: T) => EntityUpdater<T>;
  addMany: (entities: readonly T[]) => EntityUpdater<T>;
  setOne: (entity: T) => EntityUpdater<T>;
  setMany: (entities: readonly T[]) => EntityUpdater<T>;
  setAll: (entities: readonly T[]) => EntityUpdater<T>;
  updateOne: (update: EntityUpdate<T>) => EntityUpdater<T>;
  updateMany: (updates: readonly EntityUpdate<T>[]) => EntityUpdater<T>;
  upsertOne: (entity: T) => EntityUpdater<T>;
  upsertMany: (entities: readonly T[]) => EntityUpdater<T>;
  removeOne: (id: EntityId) => EntityUpdater<T>;
  removeMany: (ids: readonly EntityId[]) => EntityUpdater<T>;
  removeAll: () => EntityUpdater<T>;

  selectIds: (map: EntityMap<T>) => string[];
  selectAll: (map: EntityMap<T>) => T[];
  selectById: (map: EntityMap<T>, id: EntityId) => T | undefined;
  selectTotal: (map: EntityMap<T>) => number;
};

export type EntityAdapterOptions<T> = {
  // How to read an entity's id. Defaults to `entity.id`.
  selectId?: (entity: T) => EntityId;
  // Orders `selectAll`/`selectIds`. Omit to keep insertion order.
  sortComparer?: (a: T, b: T) => number;
};

// CRUD + selectors for a normalized entity map (`Record<id, entity>`) — the store's take on RTK's
// `createEntityAdapter`. Write ops are immutable updaters for `setState`; selectors read a map. It doesn't change the
// cost of an immutable map write, but it removes the hand-rolled spread/merge boilerplate around it.
export function createEntityAdapter<T>(options: EntityAdapterOptions<T> = {}): EntityAdapter<T> {
  const selectId = options.selectId ?? ((entity: T) => (entity as { id: EntityId }).id);
  const sortComparer = options.sortComparer;
  const keyOf = (entity: T) => String(selectId(entity));

  const writeMany =
    (entities: readonly T[], skipExisting: boolean): EntityUpdater<T> =>
    map => {
      if (entities.length === 0) {
        return map;
      }

      const next = { ...map };
      let changed = false;
      for (const entity of entities) {
        const key = keyOf(entity);
        if (skipExisting && key in next) {
          continue;
        }

        next[key] = entity;
        changed = true;
      }

      return changed ? next : map;
    };

  const mergeMany =
    (updates: readonly EntityUpdate<T>[]): EntityUpdater<T> =>
    map => {
      let next = map;
      for (const { id, changes } of updates) {
        const key = String(id);
        const existing = next[key];
        if (!existing) {
          continue;
        }

        if (next === map) {
          next = { ...map };
        }

        next[key] = { ...existing, ...changes };
      }

      return next;
    };

  const selectAll = (map: EntityMap<T>): T[] => {
    const all = Object.values(map);

    return sortComparer ? all.sort(sortComparer) : all;
  };

  return {
    getInitialState: () => ({}),
    selectId,

    addOne: entity => writeMany([entity], true),
    addMany: entities => writeMany(entities, true),
    setOne: entity => writeMany([entity], false),
    setMany: entities => writeMany(entities, false),
    setAll: entities => () => writeMany(entities, false)({}),

    updateOne: update => mergeMany([update]),
    updateMany: updates => mergeMany(updates),

    upsertOne: entity => map => {
      const key = keyOf(entity);
      const existing = map[key];

      return { ...map, [key]: existing ? { ...existing, ...entity } : entity };
    },
    upsertMany: entities => map => {
      if (entities.length === 0) {
        return map;
      }

      const next = { ...map };
      for (const entity of entities) {
        const key = keyOf(entity);
        next[key] = next[key] ? { ...next[key], ...entity } : entity;
      }

      return next;
    },

    removeOne: id => map => {
      const key = String(id);
      if (!(key in map)) {
        return map;
      }

      return Object.fromEntries(Object.entries(map).filter(([entryKey]) => entryKey !== key));
    },
    removeMany: ids => map => {
      const remove = new Set(ids.map(String));
      if (!Object.keys(map).some(key => remove.has(key))) {
        return map;
      }

      return Object.fromEntries(Object.entries(map).filter(([key]) => !remove.has(key)));
    },
    removeAll: () => () => ({}),

    selectIds: map => (sortComparer ? selectAll(map).map(keyOf) : Object.keys(map)),
    selectAll,
    selectById: (map, id) => map[String(id)],
    selectTotal: map => Object.keys(map).length
  };
}
