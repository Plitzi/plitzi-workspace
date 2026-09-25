import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authorSpace } from '@plitzi/sdk-authoring';
import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups } from './actions.ts';
import { PLUGIN_TYPES, space } from './space/index.ts';
import { seismicTasks } from './tasks.ts';

const PORT = Number(process.env.PORT ?? 4014);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * The element this space ships itself.
 *
 * `seismicMap` is not in the SDK and never will be — a globe of earthquakes is this deployment's business. A
 * deployment hands the server the file and the type name, the server compiles it and serves it with everything else,
 * and the page authors it exactly like a heading. Two halves, and forgetting either is quiet: name a plugin the server
 * has no component for and the element resolves to nothing, on a page that renders perfectly.
 */
const plugins = {
  seismicMap: { js: path.resolve(here, 'plugins/SeismicMap/index.ts'), action: 'compile' as const }
};

/**
 * MapLibre's worker, served as the package ships it.
 *
 * The map's main thread is bundled into the plugin; its worker cannot be — it is a module the browser starts on its
 * own, next to the chunk it imports. So the package's `dist` is mounted as it is, and the element is told where
 * (`workerUrl`). Served from the installed package, the worker is always the version the plugin was built against.
 */
const maplibreDist = path.dirname(require.resolve('maplibre-gl/package.json'));

/**
 * Authored at boot from `src/space`, so saving a panel and letting `start:dev` restart the process is the whole edit
 * loop. `pluginTypes` tells the validator the one type it does not ship is on purpose.
 */
const offlineData = authorSpace(space, { pluginTypes: PLUGIN_TYPES });

/**
 * A global seismic monitor, in one server and no account.
 *
 * Nothing to sign into: everything the page shows is public. What is left is the part worth reading — a space, one
 * server task, one action document, and one element of the space's own.
 */
const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: createJsonAdapters({
    offlineData,
    // `pluginNames` is how the render knows to load them. Without it the file is compiled by nobody.
    deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }
  }),
  plugins,
  // The world's outlines (`yarn geography` writes them), read by the page like any other JSON a project serves.
  publicDir: path.resolve(here, '../public'),
  static: { '/vendor/maplibre': path.join(maplibreDist, 'dist') },
  /**
   * What turns the server half on. `lookups` is how this deployment reaches an action — with no way to read one there
   * is no endpoint at all — and `tasks` is its own half of the step catalog: what a space can do on the server is
   * decided by the process running it.
   */
  action: {
    lookups,
    tasks: seismicTasks,
    // Nothing here runs on a clock — the page's own refresh is what keeps it live — so there is no queue to keep.
    jobs: false,
    onRun: createRunLogger(consoleLogger),
    onReject: createRejectLogger(consoleLogger)
  }
});

server.listen(PORT, HOST);

console.log(`[tremor] the monitor on http://127.0.0.1:${PORT}/`);
console.log('[tremor] windows: /?window=hour · /?window=day · /?window=week · /?window=month');
console.log('[tremor] dev tools: the badge in the corner, or shift+alt+D');
