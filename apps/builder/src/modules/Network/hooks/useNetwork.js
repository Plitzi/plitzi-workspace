// Packages
import { useCallback, useState } from 'react';
import axios from 'axios';

const useNetwork = props => {
  const { initLoading = false, server, webKey, internalUsage = true } = props;
  const [networkLoading, setNetworkLoading] = useState(initLoading);

  const networkQuery = useCallback(
    async (url, params = {}, method = 'get', accessToken = '') => {
      let result;
      try {
        setNetworkLoading(true);
        method = method.toLowerCase();
        const headers = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        } else if (webKey) {
          headers.Authorization = `Bearer ${webKey}`;
        }

        let baseURL = '';
        if (internalUsage) {
          const { nodeServer } = server;
          baseURL = nodeServer;
        }

        Object.values(params).forEach(value => {
          if (value instanceof Blob && headers['Content-Type'] !== 'multipart/form-data') {
            headers['Content-Type'] = 'multipart/form-data';

            return;
          }
        });

        const dataOrParams = ['get', 'delete'].includes(method) ? 'params' : 'data';
        const { data: response, status } = await axios.request({
          url: `${baseURL}${url}`,
          method,
          headers,
          withCredentials: true,
          [dataOrParams]: params
        });
        result = response;
        if (status === 204 && method === 'delete') {
          result = { networkSuccess: true, data: null };
        }
      } catch (e) {
        console.error(e);
      } finally {
        setNetworkLoading(false);
      }

      return result;
    },
    [webKey, server?.nodeServer, internalUsage]
  );

  return { networkLoading, networkQuery };
};

export default useNetwork;
