import { useCallback, useEffect, useRef, useState } from 'react';

export type ProviderPagination = 'none' | 'url' | 'append';

export type UseProviderPaginationProps = {
  elementId: string;
  mode: ProviderPagination;
  /** Query-string key this provider pages on. Distinct per element so two lists on one page move independently. */
  pageParam: string;
  /** Records in the currently resolved window. */
  records: unknown[];
  /** Page the resolved window belongs to, as reported by the server. */
  page: number;
  refresh?: (ids?: string[], params?: Record<string, string>) => Promise<void>;
  navigate?: (url: string, isExternal?: boolean) => void;
};

const buildPageUrl = (pageParam: string, page: number) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete(pageParam);
  } else {
    url.searchParams.set(pageParam, String(page));
  }

  return `${url.pathname}${url.search}`;
};

/**
 * Drives a provider's window, in the two shapes a content site needs.
 *
 * **URL** paging writes the page into the address bar and lets the server resolve it, so the window is indexable,
 * shareable and survives the back button. **Append** keeps the accumulated records in the browser and asks the
 * server only for the next slice — the "load more" shape, which is deliberately not the default because it is
 * none of those things.
 *
 * Accumulation is keyed on the page the *server* reports, not on a local counter: a full refresh returns page one
 * and resets the list, which is what makes navigating away and back behave.
 */
const useProviderPagination = ({
  elementId,
  mode,
  pageParam,
  records,
  page,
  refresh,
  navigate
}: UseProviderPaginationProps) => {
  const [accumulated, setAccumulated] = useState<unknown[]>(records);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const mergedPage = useRef(0);

  useEffect(() => {
    if (mode !== 'append') {
      return;
    }

    if (page <= 1) {
      mergedPage.current = 1;
      setAccumulated(records);

      return;
    }

    if (mergedPage.current === page) {
      return;
    }

    mergedPage.current = page;
    setAccumulated(previous => [...previous, ...records]);
  }, [mode, page, records]);

  const goToPage = useCallback(
    async (target: number) => {
      const next = Math.max(target, 1);
      if (mode === 'url') {
        navigate?.(buildPageUrl(pageParam, next));

        return;
      }

      if (!refresh) {
        return;
      }

      setIsLoadingMore(true);
      try {
        await refresh([elementId], { [pageParam]: String(next) });
      } finally {
        setIsLoadingMore(false);
      }
    },
    [mode, navigate, pageParam, refresh, elementId]
  );

  const loadMore = useCallback(() => goToPage(page + 1), [goToPage, page]);

  return { records: mode === 'append' ? accumulated : records, isLoadingMore, goToPage, loadMore };
};

export default useProviderPagination;
