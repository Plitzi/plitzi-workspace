import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSSRServer } from '../core/createServer';

import type {
  OfflineDataRaw,
  Schema,
  Style,
  SSRAdapters,
  SSRRequest,
  SSRRscData,
  SSRSpaceDeployment,
  SSRUser
} from '@plitzi/sdk-shared';

const PORT = parseInt(process.env.SSR_PORT ?? '3002', 10);
const HOST = process.env.SSR_HOST ?? '0.0.0.0';

const getOfflineData = (): Promise<OfflineDataRaw | undefined> => {
  const fileSchema = JSON.parse(readFileSync(path.resolve(__dirname, 'schemas/basic', 'space.json'), 'utf-8')) as {
    schema: Schema;
  };
  const style = JSON.parse(readFileSync(path.resolve(__dirname, 'schemas/basic', 'style.json'), 'utf-8')) as Style;
  const offlineData = { schema: fileSchema.schema, style } satisfies OfflineDataRaw;
  console.warn('[SSR] getOfflineData: using stub adapter — returning spaceId=1');

  return Promise.resolve(offlineData);
};

const getSpaceDeployment = (): Promise<SSRSpaceDeployment> => {
  console.warn('[SSR] getSpaceDeployment: using stub adapter — returning spaceId=1');

  return Promise.resolve({
    spaceId: 1,
    environment: 'main',
    revision: 0,
    pluginNames: ['serverInfo', 'clientInfo', 'sharedInfo']
  });
};

const getRscData = async (
  _req: SSRRequest,
  _spaceId: number,
  _environment: string,
  _revision: number,
  user: SSRUser | undefined,
  ids?: string[]
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<SSRRscData> => {
  const all: Record<string, unknown> = {
    'rsc-server': {
      message: 'Hello from the Node.js SSR server!',
      renderedAt: new Date().toISOString(),
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      authenticated: !!user,
      userId: user?.id ?? null
    },
    'rsc-shared': {
      serverTimestamp: new Date().toISOString(),
      nodeVersion: process.version
    }
  };

  const serverData = ids?.length ? Object.fromEntries(ids.filter(id => id in all).map(id => [id, all[id]])) : all;

  return { serverData };
};

const adapters: SSRAdapters = { getOfflineData, getSpaceDeployment, getRscData };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createSSRServer({
  port: PORT,
  host: HOST,
  frameOptions: 'SAMEORIGIN',
  devMode: process.env.NODE_ENV !== 'production',
  static: {
    '/sdk-assets': path.resolve(process.cwd(), '../sdk/dist')
  },
  httpVersion: 1,
  // streaming: true,
  // ssrOnly: true,
  plugins: {
    serverInfo: { js: path.resolve(__dirname, 'plugins/ServerInfo.tsx'), action: 'compile', props: { var1: 'value1' } },
    clientInfo: { js: path.resolve(__dirname, 'plugins/ClientInfo.tsx'), action: 'compile', props: { var2: 'value2' } },
    sharedInfo: { js: path.resolve(__dirname, 'plugins/SharedInfo.tsx'), action: 'compile', props: { var3: 'value3' } }
  },
  adapters
});

server.listen(PORT, HOST);
