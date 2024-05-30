// Packages
import { useCallback, useEffect, useState } from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   url: string;
 *   method: 'get' | 'post' | 'put' | 'delete' | 'patch';
 *   params: object;
 *   customHeaders: object;
 *   mock: object;
 * }} props
 * @returns {{
 *   isLoading: boolean;
 *   data: object;
 *   refetch: () => void;
 *   isSuccess: boolean;
 *   isError: boolean;
 * }}
 */
const getApiRequest = async ({
  url = '',
  method = 'GET',
  params = emptyObject,
  customHeaders = emptyObject,
  mock = emptyObject
} = {}) => {
  if (mock && mock !== '{}' && mock !== emptyObject) {
    try {
      if (typeof mock === 'string') {
        return { status: 200, data: JSON.parse(mock) };
      }

      return { status: 200, data: mock };
    } catch (e) {
      return { status: 500, data: e.message };
    }
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  if (customHeaders) {
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

  const fetchOptions = { method, headers, body: formData };
  if (headers.get('Content-Type') === 'application/json') {
    fetchOptions.body = JSON.stringify(params);
  }

  if (method === 'get') {
    delete fetchOptions.body;
  }

  try {
    const res = await fetch(url, fetchOptions);

    return { status: res.status, data: await res.json() };
  } catch (e) {
    return { status: e?.statusCode ?? 500, data: e.message };
  }
};

const useApi = props => {
  const {
    url = '',
    method = 'GET',
    mock = emptyObject,
    params = emptyObject,
    customHeaders = emptyObject,
    enabled = true
  } = props;
  const [isLoading, setIsLoading] = useState(enabled);
  const [data, setData] = useState();

  const handleFetch = useCallback(() => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    getApiRequest({ url, method, mock, customHeaders, params })
      .then(response => setData(response))
      .catch(e => setData(e.message))
      .finally(() => setIsLoading(false));
  }, [enabled, params, url, method, mock, customHeaders]);

  useEffect(() => {
    handleFetch();
  }, [enabled, params, mock]);

  return {
    isLoading,
    data,
    refetch: handleFetch,
    isSuccess: !isLoading && data && data.status < 400,
    isError: !isLoading && data && data.status >= 400
  };
};

export default useApi;
