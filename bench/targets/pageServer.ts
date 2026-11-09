import { offlineDataPath } from '@plitzi/example-space';

import { createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createPlatform } from '@plitzi/sdk-server/platform';

import type { ActionEntry, ElementInteraction, Environment } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? '127.0.0.1';
const ENVIRONMENTS: Environment[] = ['main', 'development', 'staging', 'production'];
// `main` is the working copy and is rendered on every request; any other environment is published and cached.
const environment = ENVIRONMENTS.find(candidate => candidate === process.env.SPACE_ENVIRONMENT) ?? 'main';

// For measuring what compression costs a render; unset, the server's own default.
const brotliQuality = process.env.BROTLI_QUALITY === undefined ? undefined : Number(process.env.BROTLI_QUALITY);

const node = (id: string, overrides: Partial<ElementInteraction>): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'bench',
  enabled: true,
  ...overrides
});

/**
 * What a page's browser typically calls: a public action that counts something in the space's kv and answers through
 * a template. The page cache cannot hold it, so it is what a page server spends on its visitors' calls.
 */
const BENCH_CALL: ActionEntry = {
  id: 'bench-call',
  document: {
    name: 'Bench call',
    output: { count: { type: 'number' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'count' }),
      count: node('count', { action: 'kv.increment', params: { key: 'bench:calls', amount: '1' }, afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"count": {{ count.value }}}' } })
    }
  }
};

const withActions = process.env.BENCH_ACTIONS === '1';

const pages = {
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  ...(brotliQuality === undefined ? {} : { compression: { brotliQuality } }),
  adapters: createJsonAdapters({ offlineData: offlineDataPath, deployment: { spaceId: 1, environment, revision: 0 } })
};
// The page server alone, as a deployment of pages runs it; with the engine beside it (`createPlatform`) for the calls.
const server = withActions
  ? createPlatform({
      ...pages,
      action: {
        lookups: {
          getAction: (_spaceId: number, actionId: string) =>
            Promise.resolve(actionId === BENCH_CALL.id ? BENCH_CALL : undefined)
        }
      }
    })
  : createServer(pages);

await server.listen(PORT, HOST);
