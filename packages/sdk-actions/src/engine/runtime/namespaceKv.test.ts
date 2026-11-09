import { describe, expect, it } from 'vitest';

import { createKvStore } from './kvStore';
import { namespaceKv, spaceKvPatterns } from './namespaceKv';

import type { ActionKvAdapter } from '../types';

/** A store over a map, so what a space wrote can be read back as the keys the adapter was handed. */
const memory = () => {
  const keys = new Map<string, string>();
  const adapter: ActionKvAdapter = {
    get: key => Promise.resolve(keys.get(key)),
    set: (key, value) => Promise.resolve(void keys.set(key, value)),
    delete: key => Promise.resolve(void keys.delete(key)),
    increment: (key, amount) => {
      const next = Number(keys.get(key) ?? 0) + amount;
      keys.set(key, String(next));

      return Promise.resolve(next);
    },
    expire: () => Promise.resolve(),
    swap: (key, expected, next) => {
      if (keys.get(key) !== expected) {
        return Promise.resolve(false);
      }

      keys.set(key, next);

      return Promise.resolve(true);
    }
  };

  return { keys, store: createKvStore(adapter) };
};

const matches = (pattern: string, key: string): boolean =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '.*')}$`, 'u').test(key);

/** Everything a space wrote, and nothing another space did, is what its patterns name. */
describe('spaceKvPatterns', () => {
  it('matches every key a space wrote — values and lists — and none of another space', async () => {
    const { keys, store } = memory();
    const blog = namespaceKv(store, 19);
    const other = namespaceKv(store, 190);
    await blog.set('post:fox', { title: 'Fox' });
    await blog.listPut('posts', { id: 'fox', score: 1, value: {} });
    await other.set('post:fox', { title: 'Not the blog' });

    const patterns = spaceKvPatterns(19);
    const covered = [...keys.keys()].filter(key => patterns.some(pattern => matches(pattern, key)));

    expect(covered.sort()).toEqual(['kv:action:19:post:fox', 'kv:list:action:19:posts']);
  });
});
