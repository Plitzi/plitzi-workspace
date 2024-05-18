// Packages
import { useCallback, useState } from 'react';

const useNetwork = props => {
  const { initLoading = false, server, webKey, internalUsage = true } = props;
  const [networkLoading, setNetworkLoading] = useState(initLoading);

  const networkQuery = useCallback(
    async (url, params = {}, method = 'get', accessToken = '') => {
      let result;
      try {
        setNetworkLoading(true);
        method = method.toLowerCase();
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if (accessToken) {
          headers.append('Authorization', `Bearer ${accessToken}`);
        } else if (webKey) {
          headers.append('Authorization', `Bearer ${webKey}`);
        }

        let baseURL = '';
        if (internalUsage) {
          const { nodeServer } = server;
          baseURL = nodeServer;
        }

        let formData = params;
        (params instanceof FormData ? params.values() : Object.values(params)).forEach(value => {
          if (value instanceof Blob && headers.get('Content-Type') !== 'multipart/form-data') {
            headers.delete('Content-Type');

            return;
          }
        });

        if (!(formData instanceof FormData)) {
          formData = new FormData();
          Object.entries(params).forEach(([key, value]) => {
            formData.append(key, value);
          });
        }

        const fetchOptions = { method, headers, body: formData };
        if (headers.get('Content-Type') === 'application/json') {
          fetchOptions.body = JSON.stringify(params);
        }

        if (method === 'get') {
          delete fetchOptions.body;
        }

        const res = await fetch(`${baseURL}${url}`, fetchOptions);

        return await res.json();
      } catch (e) {
        console.error(e);
      } finally {
        setNetworkLoading(false);
      }

      return result?.data;
    },
    [webKey, server?.nodeServer, internalUsage]
  );

  return { networkLoading, networkQuery };
};

export default useNetwork;
