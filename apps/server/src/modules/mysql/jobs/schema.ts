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
      target_kind VARCHAR(16) NOT NULL,
      target_name VARCHAR(191) NOT NULL,
      target MEDIUMTEXT NOT NULL,
      environment VARCHAR(64) NOT NULL,
      input MEDIUMTEXT NOT NULL,
      due_at BIGINT NOT NULL,
      max_attempts INT NOT NULL,
      missed INT NULL,
      job_key VARCHAR(191) NULL,
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
      state MEDIUMTEXT NULL,
      progress TEXT NULL,
      result MEDIUMTEXT NULL,
      pause_requested TINYINT(1) NOT NULL DEFAULT 0,
      active_ms BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY action_jobs_pending (status, run_at),
      KEY action_jobs_lease (status, lease_until),
      KEY action_jobs_space (space_id, updated_at),
      KEY action_jobs_target (space_id, target_name, updated_at),
      KEY action_jobs_key (space_id, job_key, status),
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

/** A change to tables made before it, and how to tell a table still needs it. */
type SchemaUpgrade = {
  needed: (db: Queryable, prefix: string) => Promise<boolean>;
  statements: (prefix: string) => string[];
};

/** The columns a table of this database has, by name, with their types. */
const columnsOf = async (db: Queryable, table: string): Promise<Map<string, string>> => {
  const columns = await selectRows<{ name: string; type: string }>(
    db,
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );

  return new Map(columns.map(column => [column.name, column.type.toLowerCase()]));
};

const UPGRADES: readonly SchemaUpgrade[] = [
  // A `kv` key as bytes and a value past 64 KB: the table was first made with `VARCHAR` and `TEXT`.
  {
    needed: async (db, prefix) => {
      const columns = await columnsOf(db, `${prefix}action_kv`);

      return columns.get('k') !== 'varbinary' || columns.get('v') !== 'mediumtext';
    },
    statements: prefix => [
      `ALTER TABLE ${jobTables(prefix).kv} MODIFY k VARBINARY(764) NOT NULL, MODIFY v MEDIUMTEXT NOT NULL`
    ]
  },
  // The key a run set for later is replaced and cancelled by.
  {
    needed: async (db, prefix) => !(await columnsOf(db, `${prefix}action_jobs`)).has('job_key'),
    statements: prefix => [
      `ALTER TABLE ${jobTables(prefix).jobs} ADD COLUMN job_key VARCHAR(191) NULL AFTER missed,
      ADD KEY action_jobs_key (space_id, job_key, status)`
    ]
  },
  // What a job runs became a target — an action, or a job of the space's functions — beside what a job of the functions
  // keeps: what it saved, how far it is, what it answered, a pause asked of it, how long it has run. The rows already
  // there are the actions' they always were: each is given its target from its action and trigger.
  {
    needed: async (db, prefix) => !(await columnsOf(db, `${prefix}action_jobs`)).has('target_kind'),
    statements: prefix => {
      const { jobs } = jobTables(prefix);

      return [
        `ALTER TABLE ${jobs} ADD COLUMN target_kind VARCHAR(16) NULL AFTER space_id,
        ADD COLUMN target_name VARCHAR(191) NULL AFTER target_kind, ADD COLUMN target MEDIUMTEXT NULL AFTER target_name,
        ADD COLUMN state MEDIUMTEXT NULL, ADD COLUMN progress TEXT NULL, ADD COLUMN result MEDIUMTEXT NULL,
        ADD COLUMN pause_requested TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN active_ms BIGINT NOT NULL DEFAULT 0`,
        `UPDATE ${jobs} SET target_kind = 'action', target_name = action_id,
        target = JSON_OBJECT('kind', 'action', 'name', action_id, 'trigger', trigger_type)`,
        `ALTER TABLE ${jobs} MODIFY target_kind VARCHAR(16) NOT NULL, MODIFY target_name VARCHAR(191) NOT NULL,
        MODIFY target MEDIUMTEXT NOT NULL, DROP COLUMN action_id, DROP COLUMN trigger_type,
        ADD KEY action_jobs_target (space_id, target_name, updated_at)`
      ];
    }
  }
];

/**
 * What brings tables made before the columns above up to them — for a deployment that runs its own migrations: each
 * statement once, the ones its tables still lack. `ensureJobTables` does it by itself, and only where a table needs
 * it: an `ALTER` copies the table.
 */
export const mysqlJobSchemaUpgrades = (prefix = ''): string[] =>
  UPGRADES.flatMap(upgrade => upgrade.statements(prefix));

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

      for (const upgrade of UPGRADES) {
        if (await upgrade.needed(db, prefix)) {
          for (const statement of upgrade.statements(prefix)) {
            await execute(db, statement);
          }
        }
      }
    })().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    await ready;
  };
};
