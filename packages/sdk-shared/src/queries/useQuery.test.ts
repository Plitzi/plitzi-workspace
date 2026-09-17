import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  invalidateAfterWrite,
  invalidateQueries,
  invalidateQueriesForWrite,
  parseIds,
  queryCache,
  requestKey,
  useQuery
} from '.';

let seq = 0;
/** Every test on its own keys: the cache is the module's, shared by the whole file. */
const uniqueUrl = (path = '/orders') => `https://api${++seq}.test${path}`;

describe('useQuery', () => {
  it('reports loading until the first answer, then paints from the cache on the next mount', async () => {
    const url = uniqueUrl();
    const fetcher = vi.fn(() => Promise.resolve('orders'));
    const options = { key: url, meta: { url }, fetcher, staleTime: 30_000 };

    const first = renderHook(() => useQuery(options));
    expect(first.result.current.isLoading).toBe(true);
    await waitFor(() => expect(first.result.current.data).toBe('orders'));
    first.unmount();

    const second = renderHook(() => useQuery(options));
    expect(second.result.current).toMatchObject({ data: 'orders', isLoading: false, isFetching: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('asks nothing while disabled', () => {
    const url = uniqueUrl();
    const fetcher = vi.fn(() => Promise.resolve('x'));

    const { result } = renderHook(() =>
      useQuery({ key: url, meta: { url }, fetcher, staleTime: 30_000, enabled: false })
    );

    expect(result.current).toMatchObject({ isLoading: false, isFetching: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the previous answer on screen while a new key is asked for', async () => {
    const first = uniqueUrl();
    const second = uniqueUrl();
    let release: ((value: string) => void) | undefined;
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('page 1')
      .mockReturnValueOnce(
        new Promise(resolve => {
          release = resolve;
        })
      );

    const { result, rerender } = renderHook(({ url }) => useQuery({ key: url, meta: { url }, fetcher, staleTime: 0 }), {
      initialProps: { url: first }
    });
    await waitFor(() => expect(result.current.data).toBe('page 1'));

    rerender({ url: second });
    expect(result.current).toMatchObject({ data: 'page 1', isFetching: true, isLoading: false });

    await act(async () => {
      release?.('page 2');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data).toBe('page 2'));
  });

  it('never keeps an answer from before a change of session', async () => {
    const url = uniqueUrl();
    let release: ((value: string) => void) | undefined;
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('alice')
      .mockReturnValueOnce(
        new Promise(resolve => {
          release = resolve;
        })
      );

    const { result } = renderHook(() => useQuery({ key: url, meta: { url }, fetcher, staleTime: 30_000 }));
    await waitFor(() => expect(result.current.data).toBe('alice'));

    let reset: Promise<void> | undefined;
    act(() => {
      reset = queryCache.reset();
    });
    expect(result.current).toMatchObject({ data: undefined, isLoading: true });

    await act(async () => {
      release?.('bob');
      await reset;
    });
    expect(result.current.data).toBe('bob');
  });

  it('is inert without a key', () => {
    const fetcher = vi.fn(() => Promise.resolve('x'));

    const { result } = renderHook(() => useQuery({ key: undefined, meta: { url: '' }, fetcher, staleTime: 30_000 }));

    expect(result.current).toMatchObject({ data: undefined, isLoading: false, isFetching: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refetch asks again for a fresh answer', async () => {
    const url = uniqueUrl();
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

    const { result } = renderHook(() => useQuery({ key: url, meta: { url }, fetcher, staleTime: 30_000 }));
    await waitFor(() => expect(result.current.data).toBe('v1'));

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toBe('v2'));
  });
});

describe('invalidation helpers', () => {
  const mount = (url: string, tags: string[] = []) => {
    const fetcher = vi.fn(() => Promise.resolve(url));
    renderHook(() => useQuery({ key: url, meta: { url, tags }, fetcher, staleTime: 30_000 }));

    return fetcher;
  };

  it('a write invalidates the queries on its own origin only', async () => {
    const same = uniqueUrl('/cart');
    const other = uniqueUrl('/cart');
    const sameFetcher = mount(same);
    const otherFetcher = mount(other);
    await waitFor(() => expect(sameFetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(otherFetcher).toHaveBeenCalledTimes(1));

    await act(() => invalidateQueriesForWrite(`${new URL(same).origin}/cart/items`));

    expect(sameFetcher).toHaveBeenCalledTimes(2);
    expect(otherFetcher).toHaveBeenCalledTimes(1);
  });

  it('the step invalidates by URL prefix', async () => {
    const orders = uniqueUrl('/api/orders?page=2');
    const users = `${new URL(orders).origin}/api/users`;
    const ordersFetcher = mount(orders);
    const usersFetcher = mount(users);
    await waitFor(() => expect(ordersFetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(usersFetcher).toHaveBeenCalledTimes(1));

    await act(() => invalidateQueries({ url: `${new URL(orders).origin}/api/orders` }));

    expect(ordersFetcher).toHaveBeenCalledTimes(2);
    expect(usersFetcher).toHaveBeenCalledTimes(1);
  });

  it('the step invalidates by the elements that made the requests', async () => {
    const orders = uniqueUrl('/orders');
    const members = uniqueUrl('/members');
    const ordersFetcher = mount(orders, ['ordersList']);
    const membersFetcher = mount(members, ['membersList']);
    await waitFor(() => expect(ordersFetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(membersFetcher).toHaveBeenCalledTimes(1));

    await act(() => invalidateQueries({ elements: parseIds(' ordersList , nobody ') }));

    expect(ordersFetcher).toHaveBeenCalledTimes(2);
    expect(membersFetcher).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateAfterWrite', () => {
  const mountAll = async () => {
    const one = uniqueUrl('/one');
    const two = uniqueUrl('/two');
    const fetchers = [one, two].map((url, index) => {
      const fetcher = vi.fn(() => Promise.resolve(url));
      renderHook(() => useQuery({ key: url, meta: { url, tags: [`el${index}`] }, fetcher, staleTime: 30_000 }));

      return fetcher;
    });
    await waitFor(() => fetchers.forEach(fetcher => expect(fetcher).toHaveBeenCalledTimes(1)));

    return { one, fetchers };
  };

  it('refreshes what the step asked for', async () => {
    const { one, fetchers } = await mountAll();

    await act(() => invalidateAfterWrite({ mode: 'none', fallback: 'all' }));
    await act(() => invalidateAfterWrite({ mode: 'elements', fallback: 'all', elements: '' }));
    expect(fetchers.map(fetcher => fetcher.mock.calls.length)).toEqual([1, 1]);

    await act(() => invalidateAfterWrite({ mode: 'elements', fallback: 'all', elements: 'el1' }));
    expect(fetchers.map(fetcher => fetcher.mock.calls.length)).toEqual([1, 2]);

    await act(() => invalidateAfterWrite({ mode: 'origin', fallback: 'all', url: `${new URL(one).origin}/write` }));
    expect(fetchers.map(fetcher => fetcher.mock.calls.length)).toEqual([2, 2]);
  });

  it('reads a mode it does not know as the caller’s default', async () => {
    await mountAll();
    const spy = vi.spyOn(queryCache, 'invalidate');

    await act(() => invalidateAfterWrite({ mode: false, fallback: 'all' }));

    expect(spy).toHaveBeenCalledWith();
    spy.mockRestore();
  });
});

describe('requestKey', () => {
  it('is one key for one request, however its headers were written', () => {
    const a = requestKey({
      method: 'GET',
      url: '/x',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', b: '2', Authorization: 'Bearer t' }
    });
    const b = requestKey({
      method: 'get',
      url: '/x',
      credentials: 'include',
      headers: { Authorization: 'Bearer t', b: '2' }
    });

    expect(a).toBe(b);
    expect(
      requestKey({ method: 'get', url: '/x', credentials: 'include', headers: { Authorization: 'Bearer u', b: '2' } })
    ).not.toBe(b);
  });
});

describe('parseIds', () => {
  it('reads a list written as text or as an array', () => {
    expect(parseIds('a, b,,c ')).toEqual(['a', 'b', 'c']);
    expect(parseIds([' a', '', 3])).toEqual(['a']);
    expect(parseIds(undefined)).toEqual([]);
  });
});
