import { createAccountStore } from './accounts';
import { createAdmin } from './admin';
import { resolveTables, tableNames } from './config';
import { generateToken, hashPassword, verifyPassword } from './passwords';
import { createPool } from './pool';
import { SCHEMA_VERSION, migrate, schemaStatements } from './schema';
import { createSessionStore } from './sessions';
import { createSpaceTokenStore } from './spaceTokens';

import type { MysqlAdmin } from './admin';
import type { MysqlConfig } from './config';
import type { SessionStore } from './sessions';
import type { AccountAdapters } from '../../core/auth/api';
import type { IdentityAdapters } from '../../core/auth/identity';
import type { SpaceTokenAdapters } from '../../core/auth/spaceTokens';
import type { Pool } from 'mysql2/promise';

export interface MysqlStore {
  /** The pool, for a deployment with queries of its own. Ended by `close()` unless it was handed in. */
  pool: Pool;
  /** The resolved, unprefixed-plus-prefix table names, so a migration tool or an error can name one. */
  tables: Record<string, string>;
  schemaVersion: number;
  /**
   * Both halves of what `createAuth` asks for, implemented. Spread your own on top to add what only you can answer
   * — `sendMail` for the reset and validation flows, `exchangeCredential` for an external identity provider.
   */
  authAdapters: IdentityAdapters & AccountAdapters;
  /** For `createSpaceTokenApi`. Present whether or not this deployment issues space credentials. */
  spaceTokenAdapters: SpaceTokenAdapters;
  /** The account's signed-in devices: list them, end one, end the others. */
  sessions: SessionStore;
  /** Ready for `createAuth({ api })`. Replaceable: nothing here assumes an algorithm. */
  passwords: { hashPassword: typeof hashPassword; verifyPassword: typeof verifyPassword; generateToken: () => string };
  /** Seeding and administration — roles, permissions, memberships, a space's first credential. */
  admin: MysqlAdmin;
  close: () => Promise<void>;
}

/**
 * An account store on MySQL, with the tables it needs.
 *
 * This is the batteries-included half of `createAuth`. A deployment that already has users implements the adapters
 * against its own tables and never comes here; a deployment standing one up gets the schema, the queries and the
 * traps already handled:
 *
 * ```ts
 * const store = await createMysqlStore({ url: process.env.DATABASE_URL });
 *
 * const auth = createAuth({
 *   tokens: { secret, issuer },
 *   adapters: store.authAdapters,
 *   api: store.passwords
 * });
 * ```
 *
 * It connects to a MySQL server; it does not start one. Where the database lives is a deployment decision and one
 * this cannot make well — a container in development, a managed instance in production, and neither of them
 * something a library should be launching behind your back.
 */
export const createMysqlStore = async (config: MysqlConfig): Promise<MysqlStore> => {
  const { tablePrefix = '', autoMigrate = true, log } = config;
  const tables = resolveTables(tablePrefix);
  const pool = await createPool(config);
  const owned = !config.pool;

  if (autoMigrate) {
    await migrate(pool, tables, log);
  }

  return {
    pool,
    tables: tableNames(tablePrefix),
    schemaVersion: SCHEMA_VERSION,
    authAdapters: createAccountStore(pool, tables),
    spaceTokenAdapters: createSpaceTokenStore(pool, tables),
    sessions: createSessionStore(pool, tables),
    passwords: { hashPassword, verifyPassword, generateToken },
    admin: createAdmin(pool, tables),
    // A pool that was handed in is not ours to end: the deployment that opened it has other things using it.
    close: async (): Promise<void> => {
      if (owned) {
        await pool.end();
      }
    }
  };
};

/** The DDL, for a deployment whose database user may not run it — see `MysqlConfig.autoMigrate`. */
export const mysqlSchemaStatements = (tablePrefix = '', fromVersion = 0): string[] =>
  schemaStatements(resolveTables(tablePrefix), fromVersion);

export { hashPassword, verifyPassword, generateToken };
export { TABLE_NAMES, tableNames } from './config';
export { SCHEMA_VERSION } from './schema';

export type { MysqlConfig, TableKey, Tables } from './config';
export type { AccountSeed, MysqlAdmin, SpaceTokenSeed } from './admin';
export type { SessionStore, SessionSummary } from './sessions';
