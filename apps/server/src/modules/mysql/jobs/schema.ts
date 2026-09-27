import { execute, selectRows } from '../query';

import type { Queryable } from '../query';

/** The tables the job queue and the key/value store keep, backticked and prefixed. */
export type JobTables = { jobs: string; schedules: string; kv: string };

const PREFIX = /^[A-Za-z0-9_]*$/;

/**
 * Table names under a prefix. A prefix is part of an identifier, which no driver can bind as a parameter — so it is
 * held to the characters an unquoted identifier may use, and refused otherwise, rather than escaped and hoped for.
 */
export const jobTables = (prefix = ''): JobTables => {
  if (!PREFIX.test(prefix)) {
    throw new Error(`@plitzi/sdk-server/mysql: tablePrefix "${prefix}" may only use letters, digits and underscores`);
  }

  return {
    jobs: `\`${prefix}action_jobs\``,
    schedules: `\`${prefix}action_schedules\``,
    kv: `\`${prefix}action_kv\``
  };
};

const CHARSET = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * The tables, as SQL — for a deployment that runs its own migrations rather than letting the helpers create them.
 *
 * Instants are epoch milliseconds in `BIGINT`, read from the SERVER's clock; `history` and `input` are JSON kept as
 * text, because they are only ever read whole. Separate from the account store's schema and its version: a deployment
 * can use either without the other.
 *
 * A `kv` key is BYTES, as it is in Redis and in memory: under a collation `Board` and `board` — and `a` and `a ` — were
 * one key here and two everywhere else. A value is a `MEDIUMTEXT`: a `TEXT` stops at 64 KB, and past it MySQL
 * refuses the write, or cuts it short where it is not strict.
 */
export const mysqlJobSchemaStatements = (prefix = ''): string[] => {
  const t = jobTables(prefix);

  return [
    `CREATE TABLE IF NOT EXISTS ${t.jobs} (
      id VARCHAR(191) NOT NULL,
      space_id BIGINT NOT NULL,
      action_id VARCHAR(191) NOT NULL,
      environment VARCHAR(64) NOT NULL,
      trigger_type VARCHAR(64) NOT NULL,
      input MEDIUMTEXT NOT NULL,
      due_at BIGINT NOT NULL,
      max_attempts INT NOT NULL,
      missed INT NULL,
      status VARCHAR(16) NOT NULL,
      run_at BIGINT NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      lease_until BIGINT NULL,
      worker_id VARCHAR(191) NULL,
      run_id VARCHAR(191) NULL,
      cancel_requested TINYINT(1) NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      error TEXT NULL,
      history MEDIUMTEXT NOT NULL,
      expires_at BIGINT NULL,
      PRIMARY KEY (id),
      KEY action_jobs_pending (status, run_at),
      KEY action_jobs_lease (status, lease_until),
      KEY action_jobs_space (space_id, updated_at),
      KEY action_jobs_expires (expires_at)
    ) ${CHARSET}`,
    `CREATE TABLE IF NOT EXISTS ${t.schedules} (
      space_id BIGINT NOT NULL,
      action_id VARCHAR(191) NOT NULL,
      cron VARCHAR(191) NOT NULL,
      timezone VARCHAR(64) NULL,
      environment VARCHAR(64) NOT NULL,
      enabled TINYINT(1) NOT NULL,
      next_run_at BIGINT NOT NULL,
      last_fire_at BIGINT NULL,
      missed INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (space_id, action_id),
      KEY action_schedules_due (enabled, next_run_at)
    ) ${CHARSET}`,
    `CREATE TABLE IF NOT EXISTS ${t.kv} (
      k VARBINARY(764) NOT NULL,
      v MEDIUMTEXT NOT NULL,
      expires_at BIGINT NULL,
      PRIMARY KEY (k),
      KEY action_kv_expires (expires_at)
    ) ${CHARSET}`
  ];
};

/**
 * What brings a `kv` table made before the columns above up to them — for a deployment that runs its own migrations,
 * once. `ensureJobTables` does it by itself, and only when the table needs it: the `ALTER` copies the table.
 */
export const mysqlJobSchemaUpgrades = (prefix = ''): string[] => [
  `ALTER TABLE ${jobTables(prefix).kv} MODIFY k VARBINARY(764) NOT NULL, MODIFY v MEDIUMTEXT NOT NULL`
];

/** Whether the `kv` table still has the columns it was first made with. */
const kvNeedsUpgrade = async (db: Queryable, prefix: string): Promise<boolean> => {
  const columns = await selectRows<{ name: string; type: string }>(
    db,
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN ('k', 'v')`,
    [`${prefix}action_kv`]
  );
  const typeOf = (name: string) => columns.find(column => column.name === name)?.type.toLowerCase();

  return typeOf('k') !== 'varbinary' || typeOf('v') !== 'mediumtext';
};

/** The server's now, in epoch ms, as an SQL expression — what every comparison reads instead of a caller's clock. */
export const NOW_MS = 'CAST(ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)';

/** Creates the tables once per process, on first use; a failure is retried by the next call rather than remembered. */
export const ensureJobTables = (db: Queryable, prefix: string, create: boolean): (() => Promise<void>) => {
  let ready: Promise<void> | undefined;

  return async () => {
    if (!create) {
      return;
    }

    ready ??= (async () => {
      for (const statement of mysqlJobSchemaStatements(prefix)) {
        await execute(db, statement);
      }

      if (await kvNeedsUpgrade(db, prefix)) {
        for (const statement of mysqlJobSchemaUpgrades(prefix)) {
          await execute(db, statement);
        }
      }
    })().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    await ready;
  };
};
