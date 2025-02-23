import { useCallback, useEffect, useState } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

const getApiRequest = async ({
  url = '',
  method = 'get',
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

  const fetchOptions = { method, headers, body: formData as FormData | undefined | string };
  if (headers.get('Content-Type') === 'application/json') {
    fetchOptions.body = JSON.stringify(params);
  }

  if (method === 'get') {
    delete fetchOptions.body;
  }

  try {
    const res = await fetch(url, fetchOptions);

    return { status: res.status, data: (await res.json()) as string };
  } catch (e: unknown) {
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
};

const useApi = ({
  url = '',
  method = 'get',
  mock = emptyObject,
  params = emptyObject,
  customHeaders = emptyObject,
  enabled = true
}: UseApiProps) => {
  const [isLoading, setIsLoading] = useState(enabled);
  const [data, setData] = useState<{ status: number; data: unknown }>();

  const handleFetch = useCallback(() => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    getApiRequest({ url, method, mock, customHeaders, params })
      .then(response => setData(response))
      .catch((e: unknown) => setData({ status: 500, data: (e as Error).message }))
      .finally(() => setIsLoading(false));
  }, [enabled, params, url, method, mock, customHeaders]);

  useEffect(() => {
    handleFetch();
  }, [enabled, params, mock, url, handleFetch]);

  return {
    isLoading,
    data,
    refetch: handleFetch,
    isSuccess: !isLoading && data && data.status < 400,
    isError: !isLoading && data && data.status >= 400
  };
};

export default useApi;
