import { useCallback, useId, useMemo } from 'react';

import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth';
import { hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { requestKey, useQuery } from '@plitzi/sdk-shared/queries';

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
  /** What an invalidation can name this request by — an api container gives its own id. */
  tags?: readonly string[];
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
  customHeaders: Record<string, string>,
  signal: AbortSignal
): Promise<ApiResponse> => {
  if (!url) {
    return { status: 400, data: 'URL is required' };
  }

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const init: RequestInit = { method, credentials, headers, signal };
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
    // Nobody is waiting for this one any more — the cache dropped the query — so it is neither an answer to show
    // nor a failure to report. Thrown rather than answered so it cannot be mistaken for either.
    if (signal.aborted) {
      throw e;
    }

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
  gcTime = DEFAULT_GC_TIME,
  tags
}: UseApiProps) => {
  const mocked = hasMock(mock);
  const instance = useId();
  /**
   * There is no question to ask right now: the URL is empty, or it still carries a token.
   *
   * Attributes are interpolated with the tokens KEPT when nothing answers them, which is how a half-resolved URL
   * reaches here at all. It is not a rare state: a navigation writes the new page's route params a commit before the
   * outgoing page is replaced, so every provider whose URL names one of them renders once with the param gone —
   * `/workspaces/{{workspaceId}}/members` — and asked for that, which is a request nobody wants and a 404 in the
   * console of a page the visitor has already left.
   */
  const unasked = !mocked && (!url || hasValidToken(url));
  const key = useMemo(() => {
    if (mocked || unasked) {
      return undefined;
    }

    const request = requestKey({ method, url, credentials, headers: customHeaders });

    // Uncached, the answer is this provider's alone: nobody else is served it, and it goes when the provider does.
    return cache ? request : `${request}#${instance}`;
  }, [mocked, unasked, url, method, credentials, customHeaders, cache, instance]);
  const fetcher = useCallback(
    (signal: AbortSignal) => request(url, method, credentials, customHeaders, signal),
    [url, method, credentials, customHeaders]
  );
  const query = useQuery<ApiResponse>({
    key,
    meta: { url, tags },
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
    /**
     * Whether THIS question has been answered — not whether an answer is on screen.
     *
     * The last answer is kept visible while the URL is unaskable, so nothing flickers; reporting it as this URL's
     * success is a different claim and a wrong one. It fired `onApiSuccess` again on the way out of a page — the
     * URL is one of the trigger's dependencies — and the flow behind it set the workspace id from a route param
     * the page had already lost, which emptied it.
     */
    isSuccess: !unasked && !isFetching && !!data && data.status < 400,
    isError: !unasked && !isFetching && !!data && data.status >= 400
  };
};

export default useApi;
