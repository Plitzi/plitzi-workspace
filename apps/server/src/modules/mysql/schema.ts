import { tableNames } from './config';
import { execute, selectOne, selectRows } from './query';

import type { TableKey, Tables } from './config';
import type { Pool } from 'mysql2/promise';

/**
 * The tables, as SQL.
 *
 * Two decisions in here are worth stating, because getting either wrong fails much later and looks like something
 * else entirely:
 *
 * **Tokens are `TEXT`, not `VARCHAR`.** A session credential is a JWT, and a JWT's length is set by its `aud` claim
 * — one host per environment. A stack with seven audiences mints a 549-character refresh token, so a `VARCHAR(512)`
 * kills every login with "value too long" on the deployment that has the most environments and nowhere else. They
 * are indexed by prefix instead; the comparison is still exact, MySQL rechecks the full value against the row.
 *
 * **Unix seconds are `BIGINT`, not `INT`.** A signed `INT` runs out on 19 January 2038, and the credential this
 * schema stores that is allowed to live forever is exactly the one that would be written with a far-future date.
 */
const CHARSET = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const step1 = (t: Tables): string[] => [
  `CREATE TABLE IF NOT EXISTS ${t.account} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(191) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NULL,
    status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
    verified TINYINT(1) NOT NULL DEFAULT 0,
    reset_token VARCHAR(191) NULL,
    validation_token VARCHAR(191) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY account_username (username),
    UNIQUE KEY account_email (email),
    KEY account_reset_token (reset_token),
    KEY account_validation_token (validation_token)
  ) ${CHARSET}`,

  /**
   * One row per signed-in device, not one per account.
   *
   * The alternative — a token pair on the account row — is smaller and wrong in a way people notice: signing in on
   * a phone signs you out on a laptop, and "sign out my other devices" cannot be built at all. It also makes
   * renewal indistinguishable from sign-in, which is why `saveSession` is told which of the two it is.
   *
   * Rows are deleted rather than flagged. A revoked session that still exists is a row every lookup has to
   * remember to exclude, and the first query that forgets brings it back to life.
   */
  `CREATE TABLE IF NOT EXISTS ${t.session} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id INT UNSIGNED NOT NULL,
    token TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    refresh_token TEXT NULL,
    refresh_expires_at BIGINT NULL,
    user_agent VARCHAR(255) NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY session_account (account_id),
    KEY session_token (token(191)),
    KEY session_refresh_token (refresh_token(191)),
    KEY session_expires_at (expires_at),
    FOREIGN KEY (account_id) REFERENCES ${t.account} (id) ON DELETE CASCADE
  ) ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS ${t.role} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY role_name (name)
  ) ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS ${t.permission} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY permission_name (name)
  ) ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS ${t.rolePermission} (
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    KEY role_permission_permission (permission_id),
    FOREIGN KEY (role_id) REFERENCES ${t.role} (id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES ${t.permission} (id) ON DELETE CASCADE
  ) ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS ${t.accountRole} (
    account_id INT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (account_id, role_id),
    KEY account_role_role (role_id),
    FOREIGN KEY (account_id) REFERENCES ${t.account} (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ${t.role} (id) ON DELETE CASCADE
  ) ${CHARSET}`,

  // `space_id` carries no foreign key on purpose: spaces are not this schema's, and a deployment keeps them
  // wherever it keeps them. Membership is the only thing auth needs to know about one.
  `CREATE TABLE IF NOT EXISTS ${t.spaceMember} (
    space_id BIGINT UNSIGNED NOT NULL,
    account_id INT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    is_owner TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (space_id, account_id),
    KEY space_member_account (account_id),
    KEY space_member_role (role_id),
    FOREIGN KEY (account_id) REFERENCES ${t.account} (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ${t.role} (id)
  ) ${CHARSET}`,

  `CREATE TABLE IF NOT EXISTS ${t.spaceToken} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    space_id BIGINT UNSIGNED NOT NULL,
    token TEXT NOT NULL,
    scope ENUM('render','agent') NOT NULL DEFAULT 'render',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    origins TEXT NULL,
    expires_at BIGINT NULL,
    account_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY space_token_space (space_id),
    KEY space_token_token (token(191)),
    FOREIGN KEY (account_id) REFERENCES ${t.account} (id) ON DELETE CASCADE
  ) ${CHARSET}`
];

/**
 * DDL that can be run twice.
 *
 * MySQL has `CREATE TABLE IF NOT EXISTS` and nothing else: `ADD COLUMN IF NOT EXISTS` is MariaDB's, and a plain
 * `ADD COLUMN` on a second run is an error. That matters because MySQL cannot roll back DDL — a step that fails
 * halfway has already applied some of its statements, and the retry has to survive meeting them again.
 *
 * So a conditional is built out of what MySQL does have: look in `information_schema`, and prepare either the real
 * statement or a no-op. Emitted as separate statements because the driver sends one at a time.
 *
 * Every step after the first should be written with these. `schemaStatements()` still returns plain SQL, so a
 * deployment migrating with its own tool gets the same guards.
 */
const QUOTE = String.fromCharCode(39);

/** A SQL string literal. The statement being embedded is DDL, so it routinely contains quotes of its own. */
const literal = (value: string): string =>
  `${QUOTE}${value.replace(/\\/g, '\\\\').replace(/'/g, QUOTE + QUOTE)}${QUOTE}`;

const conditional = (test: string, statement: string): string[] => [
  `SET @plitzi_ddl := (SELECT IF(${test}, ${literal(statement)}, 'DO 0'))`,
  'PREPARE plitzi_ddl_stmt FROM @plitzi_ddl',
  'EXECUTE plitzi_ddl_stmt',
  'DEALLOCATE PREPARE plitzi_ddl_stmt'
];

const columnExists = (table: string, column: string): string =>
  'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ' +
  `AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`;

const indexExists = (table: string, index: string): string =>
  'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ' +
  `AND TABLE_NAME = '${table}' AND INDEX_NAME = '${index}'`;

/** Adds a column unless it is already there. `definition` is everything after the column name. */
export const addColumn = (table: string, column: string, definition: string): string[] =>
  conditional(
    `(${columnExists(table, column)}) = 0`,
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
  );

/** Removes a column if it is there. Data goes with it — a step that does this is not reversible. */
export const dropColumn = (table: string, column: string): string[] =>
  conditional(`(${columnExists(table, column)}) > 0`, `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);

/** Adds an index unless one of that name exists. `definition` is the parenthesised column list. */
export const addIndex = (table: string, index: string, definition: string): string[] =>
  conditional(`(${indexExists(table, index)}) = 0`, `ALTER TABLE \`${table}\` ADD INDEX \`${index}\` ${definition}`);

interface Step {
  version: number;
  statements: (tables: Tables) => string[];
}

/** Append only. A released version is never edited — the deployments that already ran it would never see the change. */
const STEPS: Step[] = [{ version: 1, statements: step1 }];

export const SCHEMA_VERSION = STEPS[STEPS.length - 1].version;

/**
 * Every statement this schema is made of, in order — for a deployment that runs `autoMigrate: false` and applies
 * DDL through its own migration tool, which is the normal arrangement anywhere the application's database user is
 * not allowed to alter tables.
 */
export const schemaStatements = (tables: Tables, fromVersion = 0): string[] =>
  STEPS.filter(step => step.version > fromVersion).flatMap(step => step.statements(tables));

/**
 * The order tables must be dropped in, children first. Foreign keys make the wrong order an error rather than a
 * silent mess, but the error names a constraint and not what to do about it.
 */
const DROP_ORDER: TableKey[] = [
  'spaceToken',
  'spaceMember',
  'accountRole',
  'rolePermission',
  'session',
  'account',
  'role',
  'permission',
  'schemaVersion'
];

/** Which of OUR tables the database already has. Asked of `information_schema`, scoped to this database. */
const existingTables = async (pool: Pool, prefix: string): Promise<string[]> => {
  const wanted = Object.values(tableNames(prefix));
  const placeholders = wanted.map(() => '?').join(', ');
  const rows = await selectRows<{ name: string }>(
    pool,
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    wanted
  );

  return rows.map(row => row.name);
};

const readVersion = async (pool: Pool, tables: Tables): Promise<number> => {
  const row = await selectOne<{ version: number }>(
    pool,
    `SELECT version FROM ${tables.schemaVersion} WHERE component = 'sdk-server-auth'`
  );

  return row?.version ?? 0;
};

/**
 * Brings the schema up to date, once.
 *
 * The advisory lock is not decoration: an all-in-one deployment starts several roles against one database at the
 * same moment, and without it they race to create the same tables and to bump the same version row. `IF NOT EXISTS`
 * makes the statements survive that; the version bump would not.
 */
export const migrate = async (
  pool: Pool,
  tables: Tables,
  options: { prefix?: string; adoptExisting?: boolean; log?: (message: string) => void } = {}
): Promise<number> => {
  const { prefix = '', adoptExisting = false, log } = options;

  /**
   * A database this schema has never been migrated into, that already has tables with these names, is almost
   * certainly somebody else's — `role`, `permission` and `session` are among the most ordinary names there are, and
   * this module is explicitly meant to be pointed at a database with unrelated tables in it.
   *
   * `CREATE TABLE IF NOT EXISTS` would quietly ADOPT them, and the failure would surface much later as a query
   * against columns that are not there. Refused instead, naming the fix.
   */
  if (!adoptExisting) {
    const present = await existingTables(pool, prefix);
    const migrated = present.includes(tableNames(prefix).schemaVersion) && (await readVersion(pool, tables)) > 0;

    if (present.length > 0 && !migrated) {
      throw new Error(
        `@plitzi/sdk-server/mysql: this database already has tables named ${present.join(', ')}, and they were ` +
          'not created by this schema. Point it at another database, set `tablePrefix` so the names cannot ' +
          'collide, or pass `adoptExisting: true` if they really are this schema\u2019s and you are re-attaching.'
      );
    }
  }

  await execute(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tables.schemaVersion} (
      component VARCHAR(64) NOT NULL,
      version INT UNSIGNED NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (component)
    ) ${CHARSET}`
  );

  const connection = await pool.getConnection();
  const lockName = `${tables.schemaVersion.replace(/`/g, '')}_sdk_server`.slice(0, 64);

  try {
    const locked = await selectOne<{ acquired: number | null }>(connection, 'SELECT GET_LOCK(?, 30) AS acquired', [
      lockName
    ]);

    if (locked?.acquired !== 1) {
      throw new Error(
        `@plitzi/sdk-server/mysql: timed out waiting for the schema lock "${lockName}". Another process is ` +
          'migrating this database, or one died holding the lock.'
      );
    }

    try {
      const current = await readVersion(pool, tables);

      /**
       * The database is ahead of the code. That means an older process has been started against a schema a newer
       * one migrated, and letting it run is worse than refusing: it would read and write rows shaped by rules it
       * does not have. The usual cause is a rollback that rolled back the code and not the database.
       */
      if (current > SCHEMA_VERSION) {
        throw new Error(
          `@plitzi/sdk-server/mysql: this database is at auth schema version ${current} and this build only knows ` +
            `${SCHEMA_VERSION}. Upgrade @plitzi/sdk-server, or point this process at a database it understands.`
        );
      }

      if (current === SCHEMA_VERSION) {
        return current;
      }

      /**
       * One step at a time, with the version written after EACH.
       *
       * MySQL cannot roll back DDL, so a step that fails halfway leaves the database between two versions. Bumping
       * once at the end would make the next run start over from `current` and re-apply the statements that had
       * already succeeded — which is exactly when a non-idempotent `ADD COLUMN` turns a recoverable failure into a
       * stuck deployment. Recording each step means a retry resumes at the one that failed.
       */
      for (const step of STEPS.filter(candidate => candidate.version > current)) {
        for (const statement of step.statements(tables)) {
          await execute(connection, statement);
        }

        await execute(
          connection,
          `INSERT INTO ${tables.schemaVersion} (component, version) VALUES ('sdk-server-auth', ?)
           ON DUPLICATE KEY UPDATE version = VALUES(version)`,
          [step.version]
        );

        log?.(`[mysql] auth schema migrated to version ${step.version}`);
      }

      return SCHEMA_VERSION;
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    connection.release();
  }
};

/**
 * Removes this schema and nothing else.
 *
 * For a deployment that pointed the store at a database it shares with other things and has now stopped using
 * `@plitzi/sdk-server` — dropping the database would take the rest of their application with it, and working out
 * which nine tables were ours is not something anybody should have to do by hand at that moment.
 *
 * It drops **only** the names this schema owns, children first so the foreign keys allow it, and it refuses to
 * touch a database it was never migrated into: without that check, a typo in `tablePrefix` turns this into a tool
 * that deletes somebody else's `role` table.
 */
export const dropSchema = async (
  pool: Pool,
  tables: Tables,
  options: { prefix?: string; force?: boolean; log?: (message: string) => void } = {}
): Promise<string[]> => {
  const { prefix = '', force = false, log } = options;
  const present = await existingTables(pool, prefix);

  if (present.length === 0) {
    return [];
  }

  if (!force && !present.includes(tableNames(prefix).schemaVersion)) {
    throw new Error(
      `@plitzi/sdk-server/mysql: refusing to drop ${present.join(', ')} — there is no ${tableNames(prefix).schemaVersion} ` +
        'table, so this schema was never migrated into this database and those tables are somebody else’s. ' +
        'Check `tablePrefix`, or pass `force: true` if you are certain.'
    );
  }

  const dropped: string[] = [];
  for (const key of DROP_ORDER) {
    const name = tableNames(prefix)[key];
    if (present.includes(name)) {
      await execute(pool, `DROP TABLE IF EXISTS ${tables[key]}`);
      dropped.push(name);
    }
  }

  log?.(`[mysql] dropped ${dropped.length} auth tables: ${dropped.join(', ')}`);

  return dropped;
};
