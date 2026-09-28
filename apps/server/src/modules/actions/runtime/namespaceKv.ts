import { DEFAULT_KV_PREFIX, LIST_SEGMENT } from './kvStore';

import type { ActionKvStore } from '../types';

/**
 * Prefixes every key with the space that wrote it.
 *
 * A shared store with unprefixed keys is one space reading — or overwriting — another's counters, which is the
 * cross-tenant leak this whole design exists to avoid. Done at the runner rather than in each task so a
 * deployment's own tasks inherit it too.
 */
const spaceScope = (spaceId: number): string => `action:${spaceId}:`;

export const namespaceKv = (store: ActionKvStore, spaceId: number): ActionKvStore => {
  const scoped = (key: string) => `${spaceScope(spaceId)}${key}`;

  return {
    get: key => store.get(scoped(key)),
    set: (key, value, ttlSeconds) => store.set(scoped(key), value, ttlSeconds),
    delete: key => store.delete(scoped(key)),
    increment: (key, amount, ttlSeconds) => store.increment(scoped(key), amount, ttlSeconds),
    swap: (key, expected, next, ttlSeconds) => store.swap(scoped(key), expected, next, ttlSeconds),
    listPut: (list, entry, options) => store.listPut(scoped(list), entry, options),
    listRange: (list, range) => store.listRange(scoped(list), range),
    listRemove: (list, id) => store.listRemove(scoped(list), id)
  };
};

/**
 * Every key a space's store holds, as patterns over the adapter's keys (`createKvStore`'s `prefix`, `kv:` unless it was
 * given another) — for whoever has to let all of them go at once: a space that is deleted, or reset to how it started.
 */
export const spaceKvPatterns = (spaceId: number, prefix = DEFAULT_KV_PREFIX): string[] => [
  `${prefix}${spaceScope(spaceId)}*`,
  `${prefix}${LIST_SEGMENT}${spaceScope(spaceId)}*`
];
