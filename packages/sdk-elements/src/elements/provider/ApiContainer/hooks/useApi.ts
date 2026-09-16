import { useCallback, useId, useMemo } from 'react';

import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useQuery } from '@plitzi/sdk-shared/queries';

export type ApiResponse = { status: number; data: unknown };

export type UseApiProps = {
  url?: string;
  method?: 'get' | 'post' | 'put' | 'delete' | 'patch';
  /** Answers instead of the network — what the builder renders with while the page is being edited. */
  mock?: Record<string, unknown> | string;
  customHeaders?: Record<string, string>;
  enabled?: boolean;
  credentials?: RequestCredentials;
  /**
   * Keep answers in the page's query cache and share them with every provider asking the same thing. Off, each
   * provider asks for itself on every mount and forgets the answer when it unmounts — the behaviour a page gets
   * unless its author opted in.
   */
  cache?: boolean;
  /** With `cache`: how long an answer is served without asking again, in seconds. `0` asks on every mount. */
  staleTime?: number | string;
  /** With `cache`: how long an answer nobody renders is kept, in seconds. */
  gcTime?: number | string;
};

export const DEFAULT_STALE_TIME = 30;

export const DEFAULT_GC_TIME = 300;

const hasMock = (mock: UseApiProps['mock']): mock is Record<string, unknown> | string =>
  !!mock && mock !== '{}' && mock !== emptyObject;

const mockResponse = (mock: Record<string, unknown> | string): ApiResponse => {
  if (typeof mock !== 'string') {
    return { status: 200, data: mock };
  }

  try {
    return { status: 200, data: JSON.parse(mock) as unknown };
  } catch (e) {
    return { status: 500, data: (e as Error).message };
  }
};

const request = async (
  url: string,
  method: NonNullable<UseApiProps['method']>,
  credentials: RequestCredentials,
  customHeaders: Record<string, string>
): Promise<ApiResponse> => {
  if (!url) {
    return { status: 400, data: 'URL is required' };
  }

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const init: RequestInit = { method, credentials, headers };
  if (method !== 'get') {
    init.body = '{}';
  }

  try {
    const res = await fetch(url, init);
    const data: unknown = await res.json();
    // The request a page makes on its own behalf is often the first to learn that the session behind it ended.
    // Reporting it renews or ends the session now rather than at the next revalidation; auth ignores refusals from
    // backends that are not its own, so pointing this element at a third-party API costs nothing.
    const reason = authFailureFromResponse(res.status, data);
    if (reason) {
      reportAuthFailure({ reason, url });
    }

    return { status: res.status, data };
  } catch (e: unknown) {
    console.error((e as Error).message);

    return { status: 500, data: (e as Error).message };
  }
};

/** A refusal is shown, never kept: the next provider to mount asks again rather than being served the failure. */
const isCacheable = (response: ApiResponse) => response.status < 400;

/** Seconds as the builder stores them — a text field — into milliseconds; anything unreadable is the default. */
const toMilliseconds = (seconds: number | string, fallback: number): number => {
  const value = typeof seconds === 'number' ? seconds : Number(seconds);

  return (Number.isFinite(value) && value >= 0 ? value : fallback) * 1000;
};

const useApi = ({
  url = '',
  method = 'get',
  mock,
  customHeaders = emptyObject,
  enabled = true,
  credentials = 'same-origin',
  cache = false,
  staleTime = DEFAULT_STALE_TIME,
  gcTime = DEFAULT_GC_TIME
}: UseApiProps) => {
  const mocked = hasMock(mock);
  const instance = useId();
  /**
   * Everything that changes the answer. The headers carry the visitor's token, so two visitors — or one before and
   * after signing in — never share an entry; sorted, so the order an author typed them in does not split one.
   */
  const key = useMemo(() => {
    // Nothing to ask: a mock answers for itself, and an empty URL is a binding that has not resolved yet.
    if (mocked || !url) {
      return undefined;
    }

    const request = JSON.stringify([
      method,
      url,
      credentials,
      Object.entries(customHeaders).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    ]);

    // Uncached, the answer is this provider's alone: nobody else is served it, and it goes when the provider does.
    return cache ? request : `${request}#${instance}`;
  }, [mocked, url, method, credentials, customHeaders, cache, instance]);
  const fetcher = useCallback(
    () => request(url, method, credentials, customHeaders),
    [url, method, credentials, customHeaders]
  );
  const query = useQuery<ApiResponse>({
    key,
    meta: { url },
    fetcher,
    enabled,
    staleTime: cache ? toMilliseconds(staleTime, DEFAULT_STALE_TIME) : 0,
    gcTime: cache ? toMilliseconds(gcTime, DEFAULT_GC_TIME) : 0,
    isCacheable
  });
  const mockData = useMemo(() => (mocked ? mockResponse(mock) : undefined), [mocked, mock]);
  const data = enabled && mockData ? mockData : query.data;
  const isFetching = !mockData && query.isFetching;

  return {
    /**
     * Nothing has been answered yet, so there is nothing truthful to render.
     *
     * Distinct from `isFetching` on purpose: a REFETCH already has an answer on screen and it stays valid until
     * the next one lands. Conflating the two makes every refresh unmount whatever the provider is feeding — the
     * page collapses to nothing, the browser clamps the scroll to the top, and the content reappears a frame
     * later. That reads as a flicker and a lost scroll position, which is not what "reload this list" means.
     */
    isLoading: isFetching && data === undefined,
    /** A request is in flight, first or not. What a spinner binds to. */
    isFetching,
    data,
    refetch: query.refetch,
    isSuccess: !isFetching && !!data && data.status < 400,
    isError: !isFetching && !!data && data.status >= 400
  };
};

export default useApi;
