import { afterAll, describe, expect, it } from 'vitest';

import { createMysqlJobQueue } from './jobQueue';
import { createMysqlKv } from './kv';
import { jobTables } from './schema';
import { describeJobQueue, describeKv } from '../../actions/jobs/testing/jobQueueContract';
import { createPool } from '../pool';
import { execute } from '../query';

import type { Pool } from 'mysql2/promise';

/**
 * The MySQL helpers against a real MySQL, through the same contract the in-process stores keep.
 *
 * Same database and credentials as the account store's integration test, under a prefix of its own; skipped — not
 * failed — on a machine with no MySQL.
 */
const PREFIX = 'itest_jobs_';

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

afterAll(async () => {
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

describe.skipIf(pool === undefined)('mysql — tables a release before made', () => {
  const LEGACY = 'itest_legacy_';
  const legacy = jobTables(LEGACY);

  /** What 0.38.20 made: a job named by `action_id` and `trigger_type`, with none of what a job of the functions keeps. */
  it('brings them up to targets, keeping the jobs that were there as the runs of actions they were', async () => {
    const db = connected();
    for (const table of [legacy.jobs, legacy.schedules, legacy.kv]) {
      await execute(db, `DROP TABLE IF EXISTS ${table}`);
    }

    await execute(
      db,
      `CREATE TABLE ${legacy.jobs} (id VARCHAR(191) NOT NULL, space_id BIGINT NOT NULL, action_id VARCHAR(191) NOT NULL,
      environment VARCHAR(64) NOT NULL, trigger_type VARCHAR(64) NOT NULL, input MEDIUMTEXT NOT NULL,
      due_at BIGINT NOT NULL, max_attempts INT NOT NULL, missed INT NULL, job_key VARCHAR(191) NULL,
      status VARCHAR(16) NOT NULL, run_at BIGINT NOT NULL, attempts INT NOT NULL DEFAULT 0, lease_until BIGINT NULL,
      worker_id VARCHAR(191) NULL, run_id VARCHAR(191) NULL, cancel_requested TINYINT(1) NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, error TEXT NULL, history MEDIUMTEXT NOT NULL,
      expires_at BIGINT NULL, PRIMARY KEY (id), KEY action_jobs_space (space_id, updated_at)) ENGINE=InnoDB`
    );
    await execute(
      db,
      `INSERT INTO ${legacy.jobs} (id, space_id, action_id, environment, trigger_type, input, due_at, max_attempts,
      status, run_at, created_at, updated_at, history) VALUES ('later:7:a', 7, 'timeout', 'main', 'later', '{}', 1, 3,
      'succeeded', 1, 1, 1, '[]')`
    );

    const queue = createMysqlJobQueue({ pool: db, tablePrefix: LEGACY });
    const job = await queue.getJob([7], 'later:7:a');

    expect(job?.target).toEqual({ kind: 'action', name: 'timeout', trigger: 'later' });
    expect((await queue.listJobs({ spaceIds: [7], kind: 'action', name: 'timeout', limit: 5, offset: 0 })).total).toBe(
      1
    );

    for (const table of [legacy.jobs, legacy.schedules, legacy.kv]) {
      await execute(db, `DROP TABLE IF EXISTS ${table}`);
    }
  });
});
