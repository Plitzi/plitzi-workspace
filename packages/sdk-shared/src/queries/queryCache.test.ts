import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GC_TIME, QueryCache, queryPath } from './queryCache';

const meta = { url: 'https://api.test/orders' };

/** A fetcher whose answers the test hands out one at a time, so an in-flight request can be observed. */
const deferredFetcher = () => {
  const releases: ((value: string) => void)[] = [];
  const fetcher = vi.fn(
    () =>
      new Promise<string>(resolve => {
        releases.push(resolve);
      })
  );

  return { fetcher, release: (value: string) => releases.shift()?.(value) };
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QueryCache', () => {
  it('serves a fresh answer without asking again', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('first'));

    const stop = cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    stop();

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.getEntry('k')?.data).toBe('first');
  });

  it('shows the stale answer and asks again in the background once the TTL has passed', async () => {
    const cache = new QueryCache();
    const { fetcher, release } = deferredFetcher();

    const stop = cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    release('first');
    await flush();
    stop();

    vi.advanceTimersByTime(30_000);
    cache.observe('k', { meta, fetcher, staleTime: 30_000 });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.getEntry('k')).toMatchObject({ data: 'first', isFetching: true });

    release('second');
    await flush();
    expect(cache.getEntry('k')).toMatchObject({ data: 'second', isFetching: false });
    const freshness = cache.store.getFreshness(queryPath('k'));
    expect(freshness && freshness.expiresAt - freshness.updatedAt).toBe(30_000);
  });

  it('sends one request for observers that mount together', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('asks again at once for an active query that is invalidated', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValueOnce('before').mockResolvedValueOnce('after');

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    await cache.invalidate();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.getEntry('k')?.data).toBe('after');
  });

  it('only marks an inactive query stale, and it asks when it is shown again', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValueOnce('before').mockResolvedValueOnce('after');

    const stop = cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    stop();

    await cache.invalidate();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.getEntry('k')?.data).toBe('before');
    expect(cache.store.isStale(queryPath('k'))).toBe(true);

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    expect(cache.getEntry('k')?.data).toBe('after');
    expect(cache.store.isStale(queryPath('k'))).toBe(false);
  });

  it('invalidates only what the predicate picks', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('a', { meta: { url: 'https://a.test/x' }, fetcher, staleTime: 30_000 });
    cache.observe('b', { meta: { url: 'https://b.test/x' }, fetcher, staleTime: 30_000 });
    await flush();
    await cache.invalidate(query => query.url.startsWith('https://a.test'));

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(cache.store.isStale(queryPath('b'))).toBe(false);
  });

  it('does not trust an answer sent before an invalidation, and asks again', async () => {
    const cache = new QueryCache();
    const { fetcher, release } = deferredFetcher();

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    const invalidated = cache.invalidate();
    expect(fetcher).toHaveBeenCalledTimes(1);

    release('written before');
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);

    release('written after');
    await invalidated;
    expect(cache.getEntry('k')?.data).toBe('written after');
    expect(cache.store.isStale(queryPath('k'))).toBe(false);
  });

  it('refetch asks again whatever the age of what it holds', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    await cache.refetch('k');

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('an observer with a shorter TTL is not served an answer older than it accepts', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('k', { meta, fetcher, staleTime: 60_000 });
    cache.observe('k', { meta, fetcher, staleTime: 5_000 });
    await flush();

    const freshness = cache.store.getFreshness(queryPath('k'));
    expect(freshness && freshness.expiresAt - freshness.updatedAt).toBe(5_000);
  });

  it('keeps what it held when a request fails, and asks again on the next mount', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValueOnce('held').mockRejectedValueOnce(new Error('down'));

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    await cache.refetch('k');

    expect(cache.getEntry('k')).toMatchObject({ data: 'held', isFetching: false });
    expect(cache.getEntry('k')?.error).toBeInstanceOf(Error);
    expect(cache.store.isStale(queryPath('k'))).toBe(true);
  });

  it('anybody expiring a query path makes the provider on screen ask again — the dev-tools button, say', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValueOnce('before').mockResolvedValueOnce('after');

    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();
    cache.store.expire('entries');
    await flush();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.getEntry('k')?.data).toBe('after');
  });

  it('does not poll: a TTL running out only matters to the next mount', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('k', { meta, fetcher, staleTime: 1_000 });
    await flush();
    vi.advanceTimersByTime(5_000);
    await flush();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.store.isStale(queryPath('k'))).toBe(true);
  });

  it('with no grace period, forgets an entry the moment nobody renders it', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));
    const release = cache.hold('k', 0);
    const stop = cache.observe('k', { meta, fetcher, staleTime: 0 });
    await flush();

    stop();
    expect(cache.getEntry('k')?.data).toBe('x');
    release();
    expect(cache.getEntry('k')).toBeUndefined();
  });

  it('answers a caller that is not a component from the cache while it is current', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const options = { meta, fetcher, staleTime: 1_000, gcTime: 60_000 };

    expect(await cache.fetchQuery('k', options)).toBe('first');
    expect(await cache.fetchQuery('k', options)).toBe('first');
    vi.advanceTimersByTime(1_000);
    expect(await cache.fetchQuery('k', options)).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    expect(cache.getEntry('k')).toBeUndefined();
  });

  it('shares a request already out with a component asking the same thing', async () => {
    const cache = new QueryCache();
    const { fetcher, release } = deferredFetcher();
    cache.observe('k', { meta, fetcher, staleTime: 30_000 });

    const answer = cache.fetchQuery('k', { meta, fetcher, staleTime: 30_000 });
    release('once');

    expect(await answer).toBe('once');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps every tag anybody gave a query', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    cache.observe('k', { meta: { ...meta, tags: ['list'] }, fetcher, staleTime: 0 });
    await flush();
    cache.observe('k', { meta: { ...meta, tags: ['detail'] }, fetcher, staleTime: 0 });
    await flush();

    expect(cache.getEntry('k')?.tags).toEqual(['list', 'detail']);
  });

  it('keeps an answer it may not trust visible, but asks again on the next mount', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve({ status: 500 }));
    const options = { meta, fetcher, staleTime: 30_000, isCacheable: (data: { status: number }) => data.status < 400 };

    const stop = cache.observe('k', options);
    await flush();
    stop();
    expect(cache.getEntry('k')?.data).toEqual({ status: 500 });

    cache.observe('k', options);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('forgets everything on reset, and drops an answer that belongs to the previous session', async () => {
    const cache = new QueryCache();
    const { fetcher, release } = deferredFetcher();
    cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    release('alice');
    await flush();

    vi.advanceTimersByTime(30_000);
    const stale = cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    const reset = cache.reset();
    expect(cache.getEntry('k')?.data).toBeUndefined();
    expect(cache.hasAnswer('k')).toBe(false);

    release('alice, late');
    await flush();
    expect(cache.getEntry('k')?.data).toBeUndefined();

    release('bob');
    await reset;
    expect(cache.getEntry('k')?.data).toBe('bob');
    stale();
  });

  it('drops an entry nobody renders once the grace period is over', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn(() => Promise.resolve('x'));
    const release = cache.hold('k');
    const stop = cache.observe('k', { meta, fetcher, staleTime: 30_000 });
    await flush();

    stop();
    release();
    vi.advanceTimersByTime(GC_TIME - 1);
    expect(cache.getEntry('k')?.data).toBe('x');

    vi.advanceTimersByTime(1);
    expect(cache.getEntry('k')).toBeUndefined();
    expect(cache.store.getFreshness(queryPath('k'))).toBeUndefined();
  });
});
