import { offlineDataPath } from '@plitzi/example-space';

import { createJsonAdapters, createServer } from '@plitzi/sdk-server';

import type { Environment } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? '127.0.0.1';
const ENVIRONMENTS: Environment[] = ['main', 'development', 'staging', 'production'];
// `main` is the working copy and is rendered on every request; any other environment is published and cached.
const environment = ENVIRONMENTS.find(candidate => candidate === process.env.SPACE_ENVIRONMENT) ?? 'main';

// For measuring what compression costs a render; unset, the server's own default.
const brotliQuality = process.env.BROTLI_QUALITY === undefined ? undefined : Number(process.env.BROTLI_QUALITY);

const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  ...(brotliQuality === undefined ? {} : { compression: { brotliQuality } }),
  adapters: createJsonAdapters({ offlineData: offlineDataPath, deployment: { spaceId: 1, environment, revision: 0 } })
});

server.listen(PORT, HOST);
