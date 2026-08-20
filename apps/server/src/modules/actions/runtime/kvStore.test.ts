import { describe, expect, it } from 'vitest';

import { createKvStore } from './kvStore';
import { createMemoryKv } from './memoryKv';

import type { ActionKvAdapter } from '../types';

/** Records what reached the adapter, so the rules above it can be asserted on the calls they produce. */
const spyAdapter = () => {
  const inner = createMemoryKv();
  const calls: { method: string; args: unknown[] }[] = [];

  const adapter: ActionKvAdapter = {
    get: key => {
      calls.push({ method: 'get', args: [key] });

      return inner.get(key);
    },
    set: (key, value, ttl) => {
      calls.push({ method: 'set', args: [key, value, ttl] });

      return inner.set(key, value, ttl);
    },
    delete: key => {
      calls.push({ method: 'delete', args: [key] });

      return inner.delete(key);
    },
    increment: (key, amount) => {
      calls.push({ method: 'increment', args: [key, amount] });

      return inner.increment(key, amount);
    },
    expire: (key, ttl) => {
      calls.push({ method: 'expire', args: [key, ttl] });

      return inner.expire(key, ttl);
    }
  };

  return { adapter, calls };
};

describe('createKvStore', () => {
  it('prefixes every key before it reaches the adapter', async () => {
    const { adapter, calls } = spyAdapter();
    const kv = createKvStore(adapter);

    await kv.set('visits:home', 1);
    await kv.get('visits:home');
    await kv.delete('visits:home');

    expect(calls.map(call => call.args[0])).toEqual(['kv:visits:home', 'kv:visits:home', 'kv:visits:home']);
  });

  it('round-trips a value through JSON, so a flow reads back what it wrote', async () => {
    const kv = createKvStore(createMemoryKv());

    await kv.set('cart', { items: 2, coupon: null });

    expect(await kv.get('cart')).toEqual({ items: 2, coupon: null });
  });

  it('answers a value written by something else as the string it is', async () => {
    const adapter = createMemoryKv();
    await adapter.set('kv:legacy', 'not json');

    expect(await createKvStore(adapter).get('legacy')).toBe('not json');
  });

  it('reports a key that is not there as undefined', async () => {
    expect(await createKvStore(createMemoryKv()).get('missing')).toBeUndefined();
  });

  /** The rule a rate limit lives or dies by, and the reason it is HERE and not in each adapter: a window whose
   *  lifetime is refreshed on every hit never closes while traffic keeps arriving. The counter that created it is
   *  the one whose increment came back as its own amount — no conditional expire needed from the store. */
  it('sets a counter lifetime once, on the increment that created it', async () => {
    const { adapter, calls } = spyAdapter();
    const kv = createKvStore(adapter);

    await kv.increment('hook:abc', 1, 60);
    await kv.increment('hook:abc', 1, 60);
    await kv.increment('hook:abc', 1, 60);

    expect(calls.filter(call => call.method === 'expire')).toEqual([{ method: 'expire', args: ['kv:hook:abc', 60] }]);
  });

  it('sets no lifetime at all when none was asked for', async () => {
    const { adapter, calls } = spyAdapter();

    await createKvStore(adapter).increment('total', 1);

    expect(calls.some(call => call.method === 'expire')).toBe(false);
  });

  it('counts up across calls', async () => {
    const kv = createKvStore(createMemoryKv());

    expect(await kv.increment('n', 2)).toBe(2);
    expect(await kv.increment('n', 3)).toBe(5);
  });

  /** Deliberately not a cache: a miss means the rate limit did not count and the idempotency key was not seen. */
  it('lets an adapter that cannot answer fail the run', async () => {
    const failing = { ...createMemoryKv(), increment: () => Promise.reject(new Error('the store is unavailable')) };

    await expect(createKvStore(failing).increment('hook:abc', 1)).rejects.toThrow('unavailable');
  });

  it('takes a prefix of its own, for a store shared with other things', async () => {
    const { adapter, calls } = spyAdapter();

    await createKvStore(adapter, { prefix: 'flows:' }).set('a', 1);

    expect(calls[0].args[0]).toBe('flows:a');
  });
});
