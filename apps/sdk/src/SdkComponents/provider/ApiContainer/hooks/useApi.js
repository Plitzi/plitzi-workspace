// Packages
import { useCallback, useEffect, useState } from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

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
        return { statusCode: 200, data: JSON.parse(mock) };
      }

      return { statusCode: 200, data: mock };
    } catch (e) {
      return { statusCode: 500, data: e.message };
    }
  }

  const headers = new Headers();
  if (customHeaders) {
    Object.keys(customHeaders).forEach(key => {
      headers.append(key, customHeaders[key]);
    });
  }

  if (!url) {
    return { statusCode: 400, data: 'URL is required' };
  }

  Object.values(params).forEach(value => {
    if (value instanceof Blob && headers['Content-Type'] !== 'multipart/form-data') {
      headers['Content-Type'] = 'multipart/form-data';

      return;
    }
  });

  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const fetchOptions = { method, headers, body: formData };
  if (method === 'get') {
    delete fetchOptions.body;
  }

  const res = await fetch(url, fetchOptions);

  return { statusCode: res.status, data: await res.json() };
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
    isSuccess: !isLoading && data && data.statusCode < 400,
    isError: !isLoading && data && data.statusCode >= 400
  };
};

export default useApi;
