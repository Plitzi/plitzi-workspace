import { describe, expect, it } from 'vitest';

import { ActionRefusal } from './errors';
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
    },
    swap: (key, expected, next, ttl) => {
      calls.push({ method: 'swap', args: [key, expected, next, ttl] });

      return inner.swap(key, expected, next, ttl);
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
  it('swaps over the value get answered — an object included', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.set('seat', { taken: false, by: null });
    const read = await kv.get('seat');

    expect(await kv.swap('seat', read, { taken: true, by: 'ana' })).toBe(true);
    expect(await kv.swap('seat', read, { taken: true, by: 'luis' })).toBe(false);
    expect(await kv.get('seat')).toEqual({ taken: true, by: 'ana' });
  });

  it('swaps into a key that holds nothing when expecting undefined', async () => {
    const kv = createKvStore(createMemoryKv());

    expect(await kv.swap('first', undefined, 1)).toBe(true);
    expect(await kv.swap('first', undefined, 2)).toBe(false);
  });
});

describe('createKvStore lists', () => {
  it('keeps the highest scores first, one entry per id', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.listPut('board', { id: 'ana', score: 10, value: { name: 'Ana' } });
    await kv.listPut('board', { id: 'luis', score: 30, value: null });
    await kv.listPut('board', { id: 'ana', score: 50, value: { name: 'Ana' } });

    expect((await kv.listRange('board')).map(entry => [entry.id, entry.score])).toEqual([
      ['ana', 50],
      ['luis', 30]
    ]);
  });

  it('reads a window of it, either way round', async () => {
    const kv = createKvStore(createMemoryKv());
    for (const [id, score] of [
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4]
    ] as const) {
      await kv.listPut('l', { id, score, value: null });
    }

    expect((await kv.listRange('l', { offset: 1, limit: 2 })).map(entry => entry.id)).toEqual(['c', 'b']);
    expect((await kv.listRange('l', { order: 'asc', limit: 2 })).map(entry => entry.id)).toEqual(['a', 'b']);
  });

  it('drops the lowest scores past `keep`', async () => {
    const kv = createKvStore(createMemoryKv());
    for (let score = 1; score <= 5; score += 1) {
      await kv.listPut('latest', { id: `n${score}`, score, value: null }, { keep: 3 });
    }

    expect((await kv.listRange('latest')).map(entry => entry.id)).toEqual(['n5', 'n4', 'n3']);
  });

  it('answers what `keep` dropped, so what those entries named can be let go of too', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.listPut('latest', { id: 'old', score: 1, value: null }, { keep: 2 });
    await kv.listPut('latest', { id: 'mid', score: 2, value: null }, { keep: 2 });
    const put = await kv.listPut('latest', { id: 'new', score: 3, value: null }, { keep: 2 });

    expect(put).toEqual({ stored: true, dropped: [{ id: 'old', score: 1, value: null }] });
  });

  it('with `higherOnly`, keeps an entry whose score is higher than the one put', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.listPut('best', { id: 'ana', score: 30, value: 'thirty' });

    expect(await kv.listPut('best', { id: 'ana', score: 10, value: 'ten' }, { higherOnly: true })).toEqual({
      stored: false,
      dropped: []
    });
    expect((await kv.listPut('best', { id: 'ana', score: 30, value: 'again' }, { higherOnly: true })).stored).toBe(
      true
    );
    expect(await kv.listRange('best')).toEqual([{ id: 'ana', score: 30, value: 'again' }]);
  });

  it('removes an entry, and says whether it was there', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.listPut('l', { id: 'a', score: 1, value: null });

    expect(await kv.listRemove('l', 'a')).toBe(true);
    expect(await kv.listRemove('l', 'a')).toBe(false);
    expect(await kv.listRange('l')).toEqual([]);
  });

  it('loses no entry to writers racing for the same list', async () => {
    const kv = createKvStore(createMemoryKv());
    // The memory adapter answers at once; a store answers later, and that gap is where the writes interleave.
    const slow = createMemoryKv();
    const delayed = createKvStore({
      ...slow,
      get: async key => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3));

        return slow.get(key);
      }
    });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => delayed.listPut('race', { id: `w${i}`, score: i, value: i }))
    );
    await Promise.all(Array.from({ length: 5 }, (_, i) => kv.listPut('calm', { id: `c${i}`, score: i, value: i })));

    expect(await delayed.listRange('race')).toHaveLength(20);
    expect(await kv.listRange('calm')).toHaveLength(5);
  });

  it('refuses an id a list cannot hold, and a list larger than a store keeps', async () => {
    const kv = createKvStore(createMemoryKv());

    await expect(kv.listPut('l', { id: 'no spaces', score: 1, value: null })).rejects.toThrow('id is 1-128');
    await expect(kv.listPut('l', { id: 'big', score: 1, value: 'x'.repeat(150_000) })).rejects.toThrow(
      'keep fewer entries'
    );
  });

  it('keeps lists apart from the values a flow writes', async () => {
    const { adapter, calls } = spyAdapter();
    const kv = createKvStore(adapter);
    await kv.set('scores', 1);
    await kv.listPut('scores', { id: 'a', score: 1, value: null });

    expect(await kv.get('scores')).toBe(1);
    expect(calls.find(call => call.method === 'swap')?.args[0]).toBe('kv:list:scores');
  });
});

describe('createKvStore change', () => {
  it('loses no write to writers changing the same value at once', async () => {
    const slow = createMemoryKv();
    const kv = createKvStore({
      ...slow,
      get: async key => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3));

        return slow.get(key);
      }
    });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        kv.change('tally', current => ({
          n: (typeof current === 'object' && current && 'n' in current ? Number(current.n) : 0) + 1
        }))
      )
    );

    expect(await kv.get('tally')).toEqual({ n: 20 });
  });

  it('writes nothing when the change answers nothing, and says so', async () => {
    const kv = createKvStore(createMemoryKv());
    await kv.set('kept', 'as it was');

    expect(await kv.change('kept', () => undefined)).toBeUndefined();
    expect(await kv.get('kept')).toBe('as it was');
  });

  it('refuses, naming no key, when somebody else wins every time', async () => {
    const inner = createMemoryKv();
    const kv = createKvStore({ ...inner, swap: () => Promise.resolve(false) });
    const change = kv.change('board:abc', () => ({ n: 1 }));

    await expect(change).rejects.toBeInstanceOf(ActionRefusal);
    await expect(change).rejects.toThrow('Many people are changing this at once — try again in a moment');
  });

  it('writes with the lifetime worked out from what it writes', async () => {
    const { adapter, calls } = spyAdapter();
    const kv = createKvStore(adapter);

    expect(
      await kv.change(
        'board',
        () => ({ hours: 2 }),
        next => next.hours * 3600
      )
    ).toEqual({ hours: 2 });
    expect(calls.find(call => call.method === 'swap')?.args).toEqual(['kv:board', undefined, '{"hours":2}', 7200]);
  });
});
