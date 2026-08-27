import type { ActionKvStore } from '../types';

/**
 * Prefixes every key with the space that wrote it.
 *
 * A shared store with unprefixed keys is one space reading — or overwriting — another's counters, which is the
 * cross-tenant leak this whole design exists to avoid. Done at the runner rather than in each task so a
 * deployment's own tasks inherit it too.
 */
export const namespaceKv = (store: ActionKvStore, spaceId: number): ActionKvStore => {
  const scoped = (key: string) => `action:${spaceId}:${key}`;

  return {
    get: key => store.get(scoped(key)),
    set: (key, value, ttlSeconds) => store.set(scoped(key), value, ttlSeconds),
    delete: key => store.delete(scoped(key)),
    increment: (key, amount, ttlSeconds) => store.increment(scoped(key), amount, ttlSeconds)
  };
};
