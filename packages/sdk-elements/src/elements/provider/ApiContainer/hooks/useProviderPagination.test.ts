import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useProviderPagination from './useProviderPagination';

import type { UseProviderPaginationProps } from './useProviderPagination';

const props = (overrides: Partial<UseProviderPaginationProps> = {}): UseProviderPaginationProps => ({
  elementId: 'provider1',
  mode: 'append',
  pageParam: 'page',
  records: [],
  page: 1,
  ...overrides
});

describe('useProviderPagination', () => {
  it('passes the window straight through when not appending', () => {
    const records = [{ id: 'a' }];
    const { result } = renderHook(() => useProviderPagination(props({ mode: 'url', records })));

    expect(result.current.records).toBe(records);
  });

  it('accumulates each new page onto the list', () => {
    const { result, rerender } = renderHook(current => useProviderPagination(current), {
      initialProps: props({ records: [{ id: 'a' }], page: 1 })
    });

    expect(result.current.records).toEqual([{ id: 'a' }]);

    rerender(props({ records: [{ id: 'b' }], page: 2 }));

    expect(result.current.records).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  // The RSC payload can re-arrive unchanged (a cache hit, a parent re-render). Merging on the server-reported page
  // rather than on identity is what stops the same window being appended twice.
  it('does not append the same page twice', () => {
    const { result, rerender } = renderHook(current => useProviderPagination(current), {
      initialProps: props({ records: [{ id: 'a' }], page: 1 })
    });

    rerender(props({ records: [{ id: 'b' }], page: 2 }));
    rerender(props({ records: [{ id: 'b' }], page: 2 }));

    expect(result.current.records).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('resets the list when the provider goes back to the first page', () => {
    const { result, rerender } = renderHook(current => useProviderPagination(current), {
      initialProps: props({ records: [{ id: 'a' }], page: 1 })
    });

    rerender(props({ records: [{ id: 'b' }], page: 2 }));
    rerender(props({ records: [{ id: 'c' }], page: 1 }));

    expect(result.current.records).toEqual([{ id: 'c' }]);
  });

  it('asks the server for the next window under this element page parameter', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useProviderPagination(props({ pageParam: 'newsPage', page: 2, refresh, records: [] }))
    );

    await act(() => result.current.loadMore());

    expect(refresh).toHaveBeenCalledWith(['provider1'], { newsPage: '3' });
  });

  it('navigates instead of refreshing in url mode', async () => {
    const navigate = vi.fn();
    const refresh = vi.fn();
    const { result } = renderHook(() => useProviderPagination(props({ mode: 'url', navigate, refresh })));

    await act(() => result.current.goToPage(3));

    expect(refresh).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('page=3'));
  });
});
