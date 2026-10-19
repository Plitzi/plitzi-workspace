import { createServer } from '@plitzi/sdk-server';

import { PORTS } from '../launchConfig';
import { flagsSpace } from '../spaces';

/**
 * The flags space as a published site, its flags decided by every layer a server sees. Two of them run, from this
 * one module:
 *
 * - `PORTS.flags`, debugging authorized — a tester's forced flags (the dev tools' cookie) are honoured, on the server too;
 * - `PORTS.flagsNoDebug` with `E2E_FLAGS_NO_DEBUG`, the same site where nobody authorized debugging — the cookie means nothing,
 *   or any visitor could switch on a feature still behind a flag.
 *
 * Both turn `serverOnly` on (the `server` layer) and set one flag the space does not declare, which must be ignored.
 */
export const PORT = Number(process.env.PORT ?? (process.env.E2E_FLAGS_NO_DEBUG ? PORTS.flagsNoDebug : PORTS.flags));

const debugMode = process.env.E2E_FLAGS_NO_DEBUG !== '1';

const space = flagsSpace();

const server = createServer({
  port: PORT,
  debugMode,
  adapters: {
    getOfflineData: () => Promise.resolve({ schema: space.schema, style: space.style }),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'production', revision: 1 })
  },
  flags: { serverOnly: true, notDeclared: true },
  // Several specs read the same URL with different cookies and query strings, each wanting its own render.
  cacheTtlMs: 0
});

await server.listen(PORT, '127.0.0.1');
console.log(`[e2e] the flags space${debugMode ? ', debugging authorized,' : ''} on http://127.0.0.1:${PORT}/`);
