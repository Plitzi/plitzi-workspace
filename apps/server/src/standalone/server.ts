import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../core/createServer';
import { consoleLogger } from '../helpers/serverLog';

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

// The lib build replaces `VERSION` with the package version (see vite.config.ts `define`); running the sources
// through tsx there is no such replacement, and the MCP server reports it in its handshake.
(globalThis as typeof globalThis & { VERSION?: string }).VERSION ??= 'dev';

const PORT = parseInt(process.env.SSR_PORT ?? '3002', 10);
const HOST = process.env.SSR_HOST ?? '0.0.0.0';

const enabled = (name: string): boolean => !['0', 'false'].includes((process.env[name] ?? '').toLowerCase());

/** Which surfaces this run serves — all three unless the environment says otherwise, so the harness can exercise
 *  one at a time against the same sample space. Turning both page surfaces off (`SSR_ENABLED=0 RSC_ENABLED=0`)
 *  leaves an MCP-only config, which createServer hands to the dedicated MCP server: it then answers JSON-RPC on
 *  every path rather than under /mcp, which is the shape a real MCP deployment has. */
const services = {
  ssr: enabled('SSR_ENABLED'),
  rsc: enabled('RSC_ENABLED'),
  mcp: enabled('MCP_ENABLED')
};

const spacePath = () => path.resolve(__dirname, 'schemas/basic', 'space.json');
const stylePath = () => path.resolve(__dirname, 'schemas/basic', 'style.json');

const readSchema = (): Schema => (JSON.parse(readFileSync(spacePath(), 'utf-8')) as { schema: Schema }).schema;
const readStyle = (): Style => JSON.parse(readFileSync(stylePath(), 'utf-8')) as Style;

const getOfflineData = (): Promise<OfflineDataRaw | undefined> => {
  const offlineData = { schema: readSchema(), style: readStyle() } satisfies OfflineDataRaw;
  console.warn('[SSR] getOfflineData: using stub adapter — returning spaceId=1');

  return Promise.resolve(offlineData);
};

// MCP reads/writes schema and style as separate documents (see SSRAdapters). The stub always resolves spaceId=1.
const getSpaceId = (): Promise<number> => Promise.resolve(1);
const getSchema = (): Promise<Schema> => Promise.resolve(readSchema());
const getStyle = (): Promise<Style> => Promise.resolve(readStyle());
const saveSchema = (_spaceId: number, _environment: string, schema: Schema): Promise<void> => {
  writeFileSync(spacePath(), JSON.stringify({ schema }, null, 2));

  return Promise.resolve();
};
const saveStyle = (_spaceId: number, _environment: string, style: Style): Promise<void> => {
  writeFileSync(stylePath(), JSON.stringify(style, null, 2));

  return Promise.resolve();
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persists mcp-ai writes back to the sample space (git-restore to reset). A real platform adapter must also
// recompute style.cache; the SDK renderer reads that cache, though mcp-ai reads/writes the structured source.
const saveOfflineData = (_spaceId: number, _environment: string, data: OfflineDataRaw): Promise<void> => {
  writeFileSync(spacePath(), JSON.stringify({ schema: data.schema }, null, 2));
  writeFileSync(stylePath(), JSON.stringify(data.style, null, 2));

  return Promise.resolve();
};

const adapters: SSRAdapters = {
  getOfflineData,
  getSpaceDeployment,
  getRscData,
  saveOfflineData,
  getSpaceId,
  getSchema,
  getStyle,
  saveSchema,
  saveStyle
};

// The harness serves whichever surfaces `services` enables from a single port — pages, RSC and mcp-ai under
// /mcp — so it is the general factory it asks for, not the page one.
const server = createServer({
  port: PORT,
  host: HOST,
  frameOptions: 'SAMEORIGIN',
  devMode: process.env.NODE_ENV !== 'production',
  static: {
    '/sdk-assets': path.resolve(process.cwd(), '../sdk/dist')
  },
  httpVersion: 1,
  services,
  // This is the package's own dev harness, so the log is always on: every page, asset, RSC and MCP hit shows up in
  // the terminal, tool calls and resource reads included. Set LOG_REQUESTS=0 for a quiet run.
  logger: process.env.LOG_REQUESTS === '0' ? undefined : consoleLogger,
  // streaming: true,
  // ssrOnly: true,
  plugins: {
    serverInfo: { js: path.resolve(__dirname, 'plugins/ServerInfo.tsx'), action: 'compile', props: { var1: 'value1' } },
    clientInfo: { js: path.resolve(__dirname, 'plugins/ClientInfo.tsx'), action: 'compile', props: { var2: 'value2' } },
    sharedInfo: { js: path.resolve(__dirname, 'plugins/SharedInfo.tsx'), action: 'compile', props: { var3: 'value3' } }
  },
  adapters
});

// Says what this run actually serves: with the surfaces switchable, "listening on 3002" no longer tells you.
const active = Object.entries(services)
  .filter(([, on]) => on)
  .map(([name]) => name);
console.log(`[standalone] services: ${active.join(', ') || 'none'}`);

server.listen(PORT, HOST);
