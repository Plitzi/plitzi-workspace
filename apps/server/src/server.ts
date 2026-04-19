import { createSSRServer } from './core/createServer';

import type { SSRAdapters, SSRSpaceDeployment } from './types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const PORT = parseInt(process.env.SSR_PORT ?? '3001', 10);
const HOST = process.env.SSR_HOST ?? '0.0.0.0';

const getOfflineData = (): Promise<OfflineDataRaw | undefined> => {
  console.warn('[SSR] getOfflineData: using stub adapter — returning undefined');
  return Promise.resolve(undefined);
};

const getSpaceDeployment = (): Promise<SSRSpaceDeployment> => {
  console.warn('[SSR] getSpaceDeployment: using stub adapter — returning spaceId=1');
  return Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 });
};

const adapters: SSRAdapters = { getOfflineData, getSpaceDeployment };

const server = createSSRServer({
  port: PORT,
  host: HOST,
  sdkEnvironment: (process.env.SDK_ENVIRONMENT ?? 'production') as 'production' | 'staging' | 'development',
  devMode: process.env.NODE_ENV !== 'production',
  adapters,
  httpVersion: 1
});

server.listen(PORT, HOST);
