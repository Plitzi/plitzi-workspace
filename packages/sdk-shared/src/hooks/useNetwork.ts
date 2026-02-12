import { useCallback, useState } from 'react';

import type { Server } from '../types';

export type UseNetworkProps = {
  initLoading?: boolean;
  server?: Server;
  webKey?: string;
  internalUsage?: boolean;
};

const useNetwork = ({ initLoading = false, server, webKey, internalUsage = true }: UseNetworkProps) => {
  const [networkLoading, setNetworkLoading] = useState(initLoading);

  const networkQuery = useCallback(
    async <T = unknown>(
      url: string,
      params: FormData | Record<string, string | object | number | boolean> = {},
      method = 'get',
      accessToken = ''
    ) => {
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
        if (internalUsage && server) {
          const { nodeServer } = server;
          baseURL = nodeServer;
        }

        let formData = params;
        const valuesArray = params instanceof FormData ? Array.from(params.values()) : Object.values(params);
        valuesArray.forEach(value => {
          if (value instanceof Blob && headers.get('Content-Type') !== 'multipart/form-data') {
            headers.delete('Content-Type');

            return;
          }
        });

        if (!(formData instanceof FormData)) {
          formData = new FormData();
          Object.entries(params).forEach(([key, value]) => {
            (formData as FormData).append(key, value as string | Blob);
          });
        }

        const fetchOptions: Record<string, unknown> = { method, headers, body: formData };
        if (headers.get('Content-Type') === 'application/json') {
          fetchOptions.body = JSON.stringify(params);
        }

        if (method === 'get') {
          delete fetchOptions.body;
        }

        const res = await fetch(`${baseURL}${url}`, fetchOptions);

        return (await res.json()) as T;
      } catch (e) {
        console.error(e);
      } finally {
        setNetworkLoading(false);
      }

      return undefined;
    },
    [webKey, internalUsage, server]
  );

  return { networkLoading, networkQuery };
};

export default useNetwork;
