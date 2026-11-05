import { afterAll } from 'vitest';

import { createPool } from '@plitzi/sdk-kernel/mysql';
import { execute } from '@plitzi/sdk-kernel/mysql';
import { runName } from '@plitzi/sdk-kernel/testing';
import { dropTablesOfGoneRuns, dropTablesOfThisRun } from '@plitzi/sdk-kernel/testing';

import { createMysqlJobQueue } from './jobQueue';
import { createMysqlKv } from './kv';
import { jobTables } from './schema';
import { describeJobQueue, describeKv } from '../engine/jobs/tests/jobQueueContract';

import type { Pool } from 'mysql2/promise';

/**
 * The MySQL helpers against a real MySQL, through the same contract the in-process stores keep.
 *
 * Same database and credentials as the account store's integration test, under a prefix of its own — this run's: two
 * runs at once (another session, the workspace's suite beside a package's) emptied and locked each other's rows, and
 * a test waiting on a lock timed out. Its tables are dropped at the end, and those of a run killed before its end at
 * the start; skipped — not failed — with no MySQL.
 */
const BASE = 'itest_jobs';
const PREFIX = `${runName(BASE)}_`;

const open = async (): Promise<Pool | undefined> => {
  try {
    const pool = await createPool({
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 33006),
      user: process.env.MYSQL_USER ?? 'user',
      password: process.env.MYSQL_PASSWORD ?? 'password',
      database: process.env.MYSQL_TEST_DATABASE ?? 'plitzi_example',
      tablePrefix: PREFIX
    });
    await execute(pool, 'SELECT 1');

    return pool;
  } catch {
    return undefined;
  }
};

const pool = await open();
// Outside `open`: a failure here is one, never taken for a machine with no MySQL.
const gone = pool ? await dropTablesOfGoneRuns(pool, BASE) : [];
if (gone.length > 0) {
  console.log(`[itest] dropped what runs killed before their end left: ${gone.join(', ')}`);
}

afterAll(async () => {
  if (pool) {
    await dropTablesOfThisRun(pool, BASE);
  }

  await pool?.end();
});

/** The pool, where a test runs at all — the suites below are skipped when there is none. */
const connected = (): Pool => {
  if (!pool) {
    throw new Error('no MySQL to run against');
  }

  return pool;
};

const tables = jobTables(PREFIX);
const emptied =
  (...names: string[]) =>
  async () => {
    for (const name of names) {
      await execute(connected(), `DELETE FROM ${name}`);
    }
  };

describeJobQueue(
  'mysql',
  async () => {
    const queue = createMysqlJobQueue({ pool: connected(), tablePrefix: PREFIX });
    // The tables are made on first use; the test empties them, so it uses the queue once first.
    await queue.listSchedules([1]);

    return { queue, clear: emptied(tables.jobs, tables.schedules) };
  },
  pool !== undefined
);

describeKv(
  'mysql',
  async () => {
    const kv = createMysqlKv({ pool: connected(), tablePrefix: PREFIX });
    await kv.get('warm-up');

    return { kv, clear: emptied(tables.kv) };
  },
  pool !== undefined
);
