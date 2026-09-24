import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeOnSignals, consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups, SPACE_ID } from './actions';
import { offlineData } from './space';
import { createActivityLog } from './store/activity';
import { openDatabase } from './store/database';
import { createSqliteKv } from './store/kv';
import { createSqliteJobQueue } from './store/queue';
import { createTasks } from './tasks';

const PORT = Number(process.env.PORT ?? 4016);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on.
const HOST = process.env.HOST ?? '127.0.0.1';
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The file every replica shares. Start a second process on another port with the same path and it is a second
 * replica: same jobs, same schedules, same single-flight keys.
 */
const DATABASE = process.env.QUEUE_DB ?? path.resolve(here, '../.data/queue.db');

/** What this process is called in the job history and the activity feed. */
const REPLICA = process.env.REPLICA ?? `replica-${PORT}`;

const db = openDatabase(DATABASE);
const queue = createSqliteJobQueue(db);
const kv = createSqliteKv(db);
const activity = createActivityLog(db);

const runLogger = createRunLogger(consoleLogger);

/**
 * A page server that runs scheduled and delayed jobs, over stores it brings itself.
 *
 * Three seams make it self-hosted, and each is one key below: `jobs.queue` (where work waits), `kv` (where the run
 * guards take their single-flight keys — shared, or two replicas each think they are alone) and `lookups` (where
 * the action documents are). `sdk-server` connects to nothing on its own; everything it keeps, it keeps here.
 */
const server = createServer({
  devMode: process.env.NODE_ENV !== 'production',
  logger: consoleLogger,
  adapters: createJsonAdapters({
    offlineData: offlineData(),
    deployment: { spaceId: SPACE_ID, environment: 'main', revision: 0 }
  }),
  // The board is different on every request, which is exactly what a page cache is not for.
  cacheTtlMs: 0,
  rsc: { cacheTtlMs: 0 },
  action: {
    lookups,
    tasks: createTasks({ queue, activity, lookups, replica: REPLICA }),
    kv,
    // Room for the slow export; every other run here finishes in milliseconds.
    limits: { timeoutMs: 30_000 },
    jobs: {
      queue,
      // The self-hosted shape: one space, named once. A multi-tenant deployment answers `listScheduledSpaces`.
      spaces: [SPACE_ID],
      // Jobs this replica runs at once. The number to raise when a backlog drains too slowly.
      workers: 2,
      workerId: REPLICA,
      /**
       * Tighter than the defaults, so the demo moves at the speed of someone watching it. In production the
       * defaults are the right ones: a one-second poll, a fifteen-second sweep (a cron's resolution is a minute),
       * a thirty-second lease and a backoff that starts at thirty seconds.
       */
      pollMs: 500,
      schedulePollMs: 2_000,
      leaseMs: 10_000,
      maxAttempts: 3,
      backoff: { baseMs: 2_000, maxMs: 10_000 }
    },
    // Every run but the board's own, which the page asks for every two seconds and would drown the rest.
    onRun: record => (record.trigger === 'render' ? undefined : runLogger(record)),
    onReject: createRejectLogger(consoleLogger)
  }
});

server.listen(PORT, HOST);

/**
 * ^C drains rather than drops: `close` stops claiming, waits for the jobs this replica is RUNNING to finish — renewing
 * their claims meanwhile, so the other replica never takes one over — and only then lets go of the file. What is still
 * waiting stays in the queue for the other replica. `kill -9` is the other way out, and the one worth trying with two
 * replicas running — the job it was holding is taken over by the other one once its lease lapses.
 */
closeOnSignals(server, { afterClose: () => db.close() });

console.log(`[scheduler] ${REPLICA} on http://127.0.0.1:${PORT}/ — queue in ${DATABASE}`);
console.log(`[scheduler] a second replica: PORT=${PORT + 1} yarn start`);
