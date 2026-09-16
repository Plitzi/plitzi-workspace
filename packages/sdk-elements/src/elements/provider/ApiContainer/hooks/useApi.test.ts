import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@plitzi/sdk-shared/auth', () => ({
  authFailureFromResponse: () => undefined,
  reportAuthFailure: () => undefined
}));

const { default: useApi } = await import('./useApi');
const { queryCache } = await import('@plitzi/sdk-shared/queries');

const fetchMock = vi.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // One cache for the page, so one for the file: every test starts from a page nobody has asked anything on yet.
  await queryCache.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const answers = (body: unknown) => ({ status: 200, json: () => Promise.resolve(body) });

describe('useApi', () => {
  it('is loading only until the first answer arrives', async () => {
    fetchMock.mockResolvedValue(answers({ deployments: [1] }));

    const { result } = renderHook(() => useApi({ url: 'https://api.test/deployments' }));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ status: 200, data: { deployments: [1] } });
  });

  it('does not go back to loading on a refetch, and keeps the data it already has', async () => {
    // The invariant behind the bug: ApiContainer renders its children on `!isLoading`, so a refetch that reports
    // loading unmounts the whole subtree — the page collapses, the browser clamps the scroll to the top, and the
    // content returns a frame later. A refresh must leave the previous answer standing until the next one lands.
    fetchMock.mockResolvedValue(answers({ deployments: [1] }));

    const { result } = renderHook(() => useApi({ url: 'https://api.test/deployments' }));
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    let release: ((value: unknown) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise(resolve => {
        release = resolve;
      })
    );

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ status: 200, data: { deployments: [1] } });

    await act(async () => {
      release?.(answers({ deployments: [1, 2] }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data).toEqual({ status: 200, data: { deployments: [1, 2] } }));
  });

  it('reports success once the refetch settles, so onApiSuccess fires again', async () => {
    fetchMock.mockResolvedValue(answers({ ok: true }));

    const { result } = renderHook(() => useApi({ url: 'https://api.test/deployments' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
  });

  it('serves a provider mounted again from the cache, without asking', async () => {
    fetchMock.mockResolvedValue(answers({ tabs: 1 }));

    const first = renderHook(() => useApi({ url: 'https://api.test/tabs', cache: true }));
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useApi({ url: 'https://api.test/tabs', cache: true }));

    expect(second.result.current).toMatchObject({ isLoading: false, isFetching: false, isSuccess: true });
    expect(second.result.current.data).toEqual({ status: 200, data: { tabs: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again on every mount with no cache time', async () => {
    fetchMock.mockResolvedValue(answers({ tabs: 1 }));

    const first = renderHook(() => useApi({ url: 'https://api.test/tabs', cache: true, staleTime: '0' }));
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useApi({ url: 'https://api.test/tabs', cache: true, staleTime: '0' }));

    expect(second.result.current).toMatchObject({ isLoading: false, isFetching: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('never serves one token the answer another one got', async () => {
    fetchMock.mockResolvedValueOnce(answers({ user: 'alice' })).mockResolvedValueOnce(answers({ user: 'bob' }));

    const alice = renderHook(() =>
      useApi({ url: 'https://api.test/me', cache: true, customHeaders: { Authorization: 'Bearer alice' } })
    );
    await waitFor(() => expect(alice.result.current.isSuccess).toBe(true));

    const bob = renderHook(() =>
      useApi({ url: 'https://api.test/me', cache: true, customHeaders: { Authorization: 'Bearer bob' } })
    );
    await waitFor(() => expect(bob.result.current.data).toEqual({ status: 200, data: { user: 'bob' } }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not keep a refusal: the next mount asks again', async () => {
    fetchMock.mockResolvedValue({ status: 500, json: () => Promise.resolve({ error: 'down' }) });

    const first = renderHook(() => useApi({ url: 'https://api.test/down', cache: true }));
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    first.unmount();

    renderHook(() => useApi({ url: 'https://api.test/down', cache: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('without the cache, loads again on every mount and shares nothing', async () => {
    fetchMock.mockResolvedValue(answers({ tabs: 1 }));

    const first = renderHook(() => useApi({ url: 'https://api.test/plain' }));
    const beside = renderHook(() => useApi({ url: 'https://api.test/plain' }));
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(beside.result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    first.unmount();

    const again = renderHook(() => useApi({ url: 'https://api.test/plain' }));

    expect(again.result.current).toMatchObject({ isLoading: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it('asks nothing while its URL has not resolved', () => {
    const { result } = renderHook(() => useApi({ url: '' }));

    expect(result.current).toMatchObject({ isLoading: false, isFetching: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers from the mock without touching the network', () => {
    const { result } = renderHook(() => useApi({ url: 'https://api.test/x', mock: '{"rows":[1]}' }));

    expect(result.current).toMatchObject({ isLoading: false, isFetching: false, isSuccess: true });
    expect(result.current.data).toEqual({ status: 200, data: { rows: [1] } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays idle when disabled', () => {
    const { result } = renderHook(() => useApi({ url: 'https://api.test/x', enabled: false }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
