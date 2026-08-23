import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { lookups } from './actions';
import { offlineData } from './space';
import { seismicTasks } from './tasks';

const PORT = Number(process.env.PORT ?? 4014);
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The element this space ships itself.
 *
 * `seismicMap` is not in the SDK and never will be — a map projection is this deployment's business. A deployment
 * hands the server the file and the type name, the server compiles it and renders it with everything else, and
 * the page authors it exactly like a heading. Two halves, and forgetting either is quiet: name a plugin the
 * server has no component for and the element resolves to nothing, on a page that renders perfectly.
 */
const plugins = {
  seismicMap: { js: path.resolve(here, 'plugins/SeismicMap.tsx'), action: 'compile' as const }
};

/**
 * A global seismic monitor, in one server and no account.
 *
 * There is no auth here and nothing to sign into: everything the page shows is public, which is what makes this
 * the shortest full example in the repository. What is left is the part worth reading — a space, one server task,
 * and the action document that connects them.
 */
const server = createServer({
  port: PORT,
  devMode: true,
  logger: consoleLogger,
  adapters: createJsonAdapters({
    offlineData: offlineData(),
    // `pluginNames` is how the render knows to load them. Without it the file is compiled by nobody.
    deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: Object.keys(plugins) }
  }),
  plugins,
  /**
   * What turns the server half on. `lookups` is how this deployment reaches an action — with no way to read one
   * there is no endpoint at all — and `tasks` is its own half of the step catalog: what a space can do on the
   * server is decided by the process running it.
   *
   * The feed is a `render` trigger, so it costs nothing extra to enable: the same module resolves it while the
   * page is built, and again each time the map asks for a fresher answer.
   */
  action: {
    lookups,
    tasks: seismicTasks,
    onRun: record =>
      console.log(`[tremor] ${record.actionId} via ${record.trigger} — ${record.status} in ${record.durationMs}ms`),
    onReject: record => console.log(`[tremor] ${record.actionId} refused — ${record.reason}`)
  }
});

server.listen(PORT, '127.0.0.1');

console.log(`[tremor] the monitor on http://127.0.0.1:${PORT}/`);
console.log('[tremor] ranges: /?window=hour · /?window=day · /?window=week');
console.log('[tremor] dev tools: the badge in the corner, or shift+alt+D');
