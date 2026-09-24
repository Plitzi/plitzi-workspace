// A page server for the workers' integration tests, started in its own process. It answers with the id of the
// process that served the request, so a test can see which worker did; `/slow` takes a while, so a test can stop the
// server with a request still in flight. The `/fleet/*` routes reach the stores a server keeps in memory by default,
// through the same wiring the server uses, so a test can see whether the workers share them.
import cluster from 'node:cluster';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { consoleLogger } from '../../../../helpers/serverLog';
import { createActionsModule } from '../../../../modules/actions';
import { createMemoryDraftStore, DRAFT_STORE_METHODS } from '../../../../modules/ssr/preview';
import { createMemoryRateLimit, fleetRateLimit } from '../../../auth/throttle';
import { createServer } from '../../../createServer';
import { closeOnSignals } from '../../closeOnSignals';
import { fleetStore } from '../link';
import { runsFleetJobs } from '../role';

import type { WorkersOption } from '../role';
import type { DraftStore, SSRResponseHelpers } from '@plitzi/sdk-shared';

const port = Number(process.env.PORT);
const workers: WorkersOption | undefined =
  process.env.WORKERS === undefined ? undefined : process.env.WORKERS === 'auto' ? 'auto' : Number(process.env.WORKERS);
const plugin = process.env.PLUGIN_FILE;
const bootFail = process.env.BOOT_FAIL_FILE;

// A worker that cannot start while this file exists — a database that is down, as a replacement would meet it.
if (cluster.isWorker && bootFail && existsSync(bootFail)) {
  throw new Error('cannot start: the database is down');
}

/** Whether this process's scheduler has started: the one that runs it asks which spaces to watch as it starts. */
let scheduling = false;

const lookups = {
  getAction: () => Promise.resolve(undefined),
  listActions: () => Promise.resolve([]),
  listScheduledSpaces: () => {
    scheduling = true;

    return Promise.resolve([]);
  }
};

const server = createServer({
  port,
  workers,
  logLevel: 'info',
  logger: consoleLogger,
  pluginsCacheDir: process.env.PLUGINS_DIR,
  preview: { enabled: true },
  action: { lookups },
  ...(plugin ? { plugins: { probe: { js: plugin, action: 'compile' as const } } } : {}),
  adapters: {
    getOfflineData: () => Promise.resolve(undefined),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
  },
  middlewares: [
    async (req, res) => {
      if (req.path.startsWith('/fleet/')) {
        await fleetRoute(req.path, req.query, res);

        return;
      }

      if (req.path === '/crash') {
        // Answered first, then an error nothing catches: what a bug in a render does to the process that ran it.
        setImmediate(() => {
          throw new Error('a bug nobody caught');
        });
      }

      if (req.path === '/slow') {
        await sleep(800);
      }

      res.setHeader('Content-Type', 'text/plain');
      res.send(String(process.pid));
    }
  ]
});
// Built after the server, in every process alike, so its stores are the same ones in all of them.
const actions = createActionsModule({ lookups, jobs: {} });
const rateLimit = fleetRateLimit() ?? createMemoryRateLimit();
// The page server's own is out of reach behind `createServer`; this one is made the way it makes it.
const drafts = fleetStore<DraftStore>('ssr.drafts', DRAFT_STORE_METHODS) ?? createMemoryDraftStore();

const json = (res: SSRResponseHelpers, value: unknown): void => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ pid: process.pid, value }));
};

const fleetRoute = async (path: string, query: Record<string, string>, res: SSRResponseHelpers): Promise<void> => {
  const { key } = query;
  const queue = actions.jobs?.queue;
  switch (path) {
    case '/fleet/role':
      return json(res, { jobs: runsFleetJobs(), scheduling });
    case '/fleet/kv/increment':
      return json(res, await actions.kv(1).increment(key, 1));
    case '/fleet/kv/get':
      return json(res, await actions.kv(1).get(key));
    case '/fleet/queue/enqueue':
      return json(
        res,
        await queue?.enqueue({
          id: key,
          spaceId: 1,
          actionId: 'digest',
          environment: 'main',
          trigger: 'schedule',
          dueAt: Date.now(),
          maxAttempts: 1,
          input: {}
        })
      );
    case '/fleet/queue/claim':
      return json(
        res,
        (await queue?.claim({ workerId: String(process.pid), leaseMs: 60_000, limit: 10 }))?.map(job => job.id)
      );
    case '/fleet/queue/now':
      return json(res, (await queue?.now()) instanceof Date);
    case '/fleet/draft/put':
      // The store keeps whatever it is handed; what a draft holds is not what is under test.
      await drafts.put(key, { schema: {} } as never, { ttlMs: 60_000 });

      return json(res, true);
    case '/fleet/draft/take':
      // The worker named in `unless` declines rather than takes: a one-shot draft read back where it was written
      // would be spent without saying anything about whether the workers share it.
      if (query.unless === String(process.pid)) {
        return json(res, 'declined');
      }

      return json(res, (await drafts.take(key)) !== undefined);
    case '/fleet/login':
      return json(res, await rateLimit({ action: 'login', key }));
    default:
      res.status = 404;

      return json(res, null);
  }
};

server.listen(port, '127.0.0.1');
closeOnSignals(server);
