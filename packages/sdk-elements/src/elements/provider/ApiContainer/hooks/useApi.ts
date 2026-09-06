import { useCallback, useEffect, useState } from 'react';

import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

const getApiRequest = async ({
  url = '',
  method = 'get',
  credentials = 'same-origin',
  params = emptyObject,
  customHeaders = emptyObject,
  mock = emptyObject
}: Omit<UseApiProps, 'enabled'> = {}) => {
  if (mock && mock !== '{}' && mock !== emptyObject) {
    try {
      if (typeof mock === 'string') {
        return { status: 200, data: JSON.parse(mock) as Record<string, unknown> };
      }

      return { status: 200, data: mock };
    } catch (e) {
      return { status: 500, data: (e as Error).message };
    }
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  if (Object.keys(customHeaders).length > 0) {
    Object.keys(customHeaders).forEach(key => {
      headers.append(key, customHeaders[key]);
    });
  }

  if (!url) {
    return { status: 400, data: 'URL is required' };
  }

  Object.values(params).forEach(value => {
    if (value instanceof Blob && headers.get('Content-Type') !== 'multipart/form-data') {
      headers.set('Content-Type', 'multipart/form-data');

      return;
    }
  });

  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const fetchOptions: RequestInit = { method, credentials, headers, body: formData };
  if (headers.get('Content-Type') === 'application/json') {
    fetchOptions.body = JSON.stringify(params);
  }

  if (method === 'get') {
    delete fetchOptions.body;
  }

  try {
    const res = await fetch(url, fetchOptions);
    const data = (await res.json()) as string;
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

export type UseApiProps = {
  url?: string;
  method?: 'get' | 'post' | 'put' | 'delete' | 'patch';
  mock?: Record<string, unknown> | string;
  params?: Record<string, string | Blob>;
  customHeaders?: Record<string, string>;
  enabled?: boolean;
  credentials?: RequestCredentials;
};

const useApi = ({
  url = '',
  method = 'get',
  mock = emptyObject,
  params = emptyObject,
  customHeaders = emptyObject,
  enabled = true,
  credentials = 'same-origin'
}: UseApiProps) => {
  const [isFetching, setIsFetching] = useState(enabled);
  const [data, setData] = useState<{ status: number; data: unknown }>();

  const handleFetch = useCallback(() => {
    if (!enabled) {
      return;
    }

    setIsFetching(true);
    getApiRequest({ url, method, credentials, mock, customHeaders, params })
      .then(response => setData(response))
      .catch((e: unknown) => setData({ status: 500, data: (e as Error).message }))
      .finally(() => setIsFetching(false));
  }, [enabled, url, method, credentials, mock, customHeaders, params]);

  useEffect(() => {
    handleFetch();
  }, [enabled, params, mock, url, handleFetch]);

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
    refetch: handleFetch,
    isSuccess: !isFetching && data && data.status < 400,
    isError: !isFetching && data && data.status >= 400
  };
};

export default useApi;
