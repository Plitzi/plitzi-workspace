import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mcpExtensions } from '@plitzi/sdk-mcp';
import { createServer } from '@plitzi/sdk-server';

import { sampleSpace } from '../spaces';

import type { OfflineDataRaw, Schema, SSRPageAdapters, SSRRscContext, SSRRscData, Style } from '@plitzi/sdk-shared';

/** The suite's own server.
 *
 *  The examples are written for a person: each one shows a single wiring decision and stops, which is exactly what
 *  makes them the wrong thing to test against — a spec that needs RSC and preview at once would have to change an
 *  example to get it, and changing an example breaks what it exists to demonstrate.
 *
 *  This one has no such duty. It turns everything on at once — pages, RSC, draft preview, the MCP endpoint — so a
 *  spec can cross between them, and it is free to grow whatever a future test needs.
 *
 *  Its space lives in memory: writes through MCP are visible to the run and never touch the fixture on disk. Specs
 *  that need a pristine space should prefer `/__preview`, which renders a draft without saving anything. */

export const PORT = Number(process.env.PORT ?? 5200);
export const PREVIEW_SECRET = 'e2e-preview-secret';

const here = path.dirname(fileURLToPath(import.meta.url));

let space: OfflineDataRaw = sampleSpace();

const plugins = {
  serverInfo: { js: path.resolve(here, 'plugins/ServerProbe.tsx'), action: 'compile' as const },
  clientInfo: { js: path.resolve(here, 'plugins/ClientProbe.tsx'), action: 'compile' as const },
  sharedInfo: { js: path.resolve(here, 'plugins/SharedProbe.tsx'), action: 'compile' as const }
};

/** Fixed values, not timestamps: a spec asserting on `renderedAt` would be asserting on the clock. */
const SLICES: Record<string, unknown> = {
  'rsc-server': { message: 'from the server', nodeVersion: process.version },
  'rsc-shared': { message: 'from both' }
};

// eslint-disable-next-line @typescript-eslint/require-await
const getRscData = async ({ ids }: SSRRscContext): Promise<SSRRscData> => ({
  serverData: ids?.length ? Object.fromEntries(ids.filter(id => id in SLICES).map(id => [id, SLICES[id]])) : SLICES
});

const adapters: SSRPageAdapters = {
  getOfflineData: () => Promise.resolve(space),
  getSpaceDeployment: () =>
    Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }),
  // Every caller gets write access to space 1 — correct for a test fixture on loopback and nowhere else.
  getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent', canWrite: true }),
  getSchema: () => Promise.resolve(space.schema),
  getStyle: () => Promise.resolve(space.style),
  getRscData,
  saveSchema: (_spaceId: number, _environment: string, schema: Schema) => {
    space = { ...space, schema };

    return Promise.resolve();
  },
  saveStyle: (_spaceId: number, _environment: string, style: Style) => {
    space = { ...space, style };

    return Promise.resolve();
  }
};

const server = createServer(
  {
    port: PORT,
    devMode: true,
    adapters,
    plugins,
    preview: { enabled: true, secret: PREVIEW_SECRET },
    health: { payload: { role: 'e2e', ok: true } }
  },
  mcpExtensions()
);

server.listen(PORT, '127.0.0.1');
console.log(`[e2e] pages, RSC, preview and MCP on http://127.0.0.1:${PORT}/`);
