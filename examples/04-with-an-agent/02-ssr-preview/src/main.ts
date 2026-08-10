import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { mcpExtensions } from '@plitzi/sdk-mcp';
import { consoleLogger, createServer } from '@plitzi/sdk-server';

import { offlineDataPath } from '@plitzi/example-space';

import type { OfflineDataRaw, Schema, SSRAdapters, Style } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4006);
const PREVIEW_SECRET = 'example-secret';

const workingCopy = path.join(tmpdir(), 'plitzi-example-combined-space.json');
copyFileSync(offlineDataPath, workingCopy);

const read = (): OfflineDataRaw => JSON.parse(readFileSync(workingCopy, 'utf-8')) as OfflineDataRaw;
const write = (data: OfflineDataRaw): void => writeFileSync(workingCopy, JSON.stringify(data, null, 2));

// One adapter set feeds both surfaces: the renderer reads offline data, the tools read and write schema/style.
const adapters: SSRAdapters = {
  getOfflineData: () => Promise.resolve(read()),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, pluginNames: [] }),
  // The authorization boundary: which space, and whether this caller may change it. Normally decoded from a
  // verified bearer; every caller getting write access to space 1 is fine for an example and nowhere else.
  getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent', canWrite: true }),
  getSchema: () => Promise.resolve(read().schema),
  getStyle: () => Promise.resolve(read().style as Style),
  saveSchema: (_s, _e, schema: Schema) => {
    write({ ...read(), schema });

    return Promise.resolve();
  },
  saveStyle: (_s, _e, style: Style) => {
    write({ ...read(), style });

    return Promise.resolve();
  }
};

/** The integration this example exists for. `mcpExtensions()` hands the page server three stages — the MCP
 *  endpoint under /mcp, the widget proxy, and draft preview — all of which gate themselves, so the page routes
 *  are untouched and anything they do not claim falls through to the renderer.
 *
 *  Draft preview is what closes the loop: an agent proposes edits, the preview endpoint renders them WITHOUT
 *  saving and mints a one-shot token, and a normal page render carrying `?__pt=<token>` serves that draft. */
const server = createServer(
  {
    port: PORT,
    devMode: true,
    adapters,
    logger: consoleLogger,
    preview: { enabled: true, secret: PREVIEW_SECRET }
  },
  mcpExtensions()
);

server.listen(PORT, '127.0.0.1');
console.log(`[example] pages   http://127.0.0.1:${PORT}/`);
console.log(`[example] MCP     http://127.0.0.1:${PORT}/mcp`);
console.log(`[example] preview POST http://127.0.0.1:${PORT}/__preview  (x-preview-secret: ${PREVIEW_SECRET})`);
