import type { Pool, PoolOptions } from 'mysql2/promise';

/**
 * Where the database is, and what this deployment calls the tables in it.
 *
 * `url` and the discrete fields are two ways of saying the same thing — a hosted database hands you one string, a
 * docker-compose hands you five values — and the discrete fields win where both are given, so a single override
 * does not mean re-assembling the URL.
 */
export interface MysqlConfig {
  /** `mysql://user:password@host:port/database`. Whatever a managed database hands you, unedited. */
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Passed to the driver as given. `true` turns TLS on with the system CA set. */
  ssl?: PoolOptions['ssl'];
  connectionLimit?: number;
  /**
   * Prefix for every table below, so this schema can share a database with something else. Say it once and never
   * again: nothing outside this module ever writes a table name.
   */
  tablePrefix?: string;
  /**
   * Create and update the tables at startup. On by default, which is what makes a fresh database work with no step
   * before it. A deployment whose database user cannot run DDL — the usual arrangement in production — turns it off
   * and applies the statements from `schemaStatements()` through whatever it migrates with.
   */
  autoMigrate?: boolean;
  /**
   * Create the database itself if the server has not got it, before connecting to it. Off by default and meant for
   * development, where "point it at a MySQL and go" is the whole appeal and the alternative is one `CREATE DATABASE`
   * that nobody remembers until the first run fails. In production the database exists before the application does,
   * made by somebody holding rights the application should not have.
   */
  ensureDatabase?: boolean;
  /**
   * Use tables with these names that already exist and were not created here.
   *
   * Off by default, and the default is the safe one: this module is meant to be pointed at a database that has
   * unrelated tables in it, and `role`, `permission` and `session` are among the most ordinary names there are.
   * `CREATE TABLE IF NOT EXISTS` would silently adopt somebody else's, and the failure would surface much later as
   * a query against columns that are not there. Turn it on only when re-attaching to tables that really are this
   * schema's — a restored backup whose `schema_version` row was lost, say.
   */
  adoptExisting?: boolean;
  /** An existing pool, for a deployment that already has one. Given, nothing here creates or ends a connection. */
  pool?: Pool;
  log?: (message: string) => void;
}

/**
 * The tables the auth kernel needs. Named after the kernel's own vocabulary — an `AccountRecord` is stored in
 * `account` — rather than after any one deployment's user table, which is a thing it maps ONTO these.
 */
export const TABLE_NAMES = {
  schemaVersion: 'schema_version',
  account: 'account',
  session: 'session',
  role: 'role',
  permission: 'permission',
  rolePermission: 'role_permission',
  accountRole: 'account_role',
  spaceMember: 'space_member',
  spaceToken: 'space_token'
} as const;

export type TableKey = keyof typeof TABLE_NAMES;

/** Table names, already prefixed and already backticked — the only form the rest of the module ever sees. */
export type Tables = Record<TableKey, string>;

export const resolveTables = (prefix = ''): Tables => {
  const entries = Object.entries(TABLE_NAMES).map(([key, name]) => [key, `\`${prefix}${name}\``]);

  return Object.fromEntries(entries) as Tables;
};

/** The bare, unquoted names — for a migration tool, or an error that has to say which table it meant. */
export const tableNames = (prefix = ''): Record<TableKey, string> => {
  const entries = Object.entries(TABLE_NAMES).map(([key, name]) => [key, `${prefix}${name}`]);

  return Object.fromEntries(entries) as Record<TableKey, string>;
};
