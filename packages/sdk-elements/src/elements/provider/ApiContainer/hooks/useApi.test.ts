import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@plitzi/sdk-shared/auth', () => ({
  authFailureFromResponse: () => undefined,
  reportAuthFailure: () => undefined
}));

const { default: useApi } = await import('./useApi');

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
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

  it('stays idle when disabled', () => {
    const { result } = renderHook(() => useApi({ url: 'https://api.test/x', enabled: false }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
