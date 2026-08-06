import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createServer } from '@plitzi/sdk-mcp/server';
import { consoleLogger } from '@plitzi/sdk-server/kernel';

import { offlineDataPath } from '@plitzi/example-space';

import type { OfflineDataRaw, Schema, SSRAdapters, Style } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4005);

// The agent WRITES here, so work on a copy — a session must not dirty the shared fixture. Delete it to reset.
const workingCopy = path.join(tmpdir(), 'plitzi-example-mcp-space.json');
copyFileSync(offlineDataPath, workingCopy);

const read = (): OfflineDataRaw => JSON.parse(readFileSync(workingCopy, 'utf-8')) as OfflineDataRaw;
const write = (data: OfflineDataRaw): void => writeFileSync(workingCopy, JSON.stringify(data, null, 2));

/** What an MCP deployment has to supply. Two things make it different from the page-server adapters:
 *
 *  - schema and style are read and written as SEPARATE documents, because the tools edit them independently;
 *  - `getSpaceId` decides which space the caller is allowed to touch. It normally decodes a verified bearer,
 *    which is why the JWT secret stays on your side and this server can be stateless. Here every caller gets
 *    space 1, which is exactly what you must NOT ship. */
const adapters: SSRAdapters = {
  getOfflineData: () => Promise.resolve(read()),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, pluginNames: [] }),
  getSpaceId: () => Promise.resolve(1),
  getSchema: () => Promise.resolve(read().schema),
  getStyle: () => Promise.resolve(read().style as Style),
  saveSchema: (_spaceId, _environment, schema: Schema) => {
    write({ ...read(), schema });

    return Promise.resolve();
  },
  saveStyle: (_spaceId, _environment, style: Style) => {
    write({ ...read(), style });

    return Promise.resolve();
  }
};

// A dedicated MCP server owns its whole origin: it answers JSON-RPC on every path, not under /mcp.
const server = createServer({ port: PORT, httpVersion: 1, devMode: true, adapters, logger: consoleLogger });

server.listen(PORT, '127.0.0.1');
console.log(`[example] MCP on http://127.0.0.1:${PORT}/   (space copy: ${workingCopy})`);
console.log('[example] point an MCP client at it, or run `yarn inspector`');
