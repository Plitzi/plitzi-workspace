import { execute, selectOne } from './query';

import type { Tables } from './config';
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
export const migrate = async (pool: Pool, tables: Tables, log?: (message: string) => void): Promise<number> => {
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
      if (current >= SCHEMA_VERSION) {
        return current;
      }

      for (const statement of schemaStatements(tables, current)) {
        await execute(connection, statement);
      }

      await execute(
        connection,
        `INSERT INTO ${tables.schemaVersion} (component, version) VALUES ('sdk-server-auth', ?)
         ON DUPLICATE KEY UPDATE version = VALUES(version)`,
        [SCHEMA_VERSION]
      );

      log?.(`[mysql] auth schema migrated from version ${current} to ${SCHEMA_VERSION}`);

      return SCHEMA_VERSION;
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    connection.release();
  }
};
