import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveTables, tableNames } from './config';
import { createMysqlStore } from './index';
import { execute, selectRows } from './query';
import { dropSchema, migrate } from './schema';

import type { MysqlStore } from './index';
import type { Pool } from 'mysql2/promise';

/**
 * The half that only a real database can answer.
 *
 * Everything about this module that can go wrong quietly goes wrong in SQL: adopting somebody else's table because
 * `CREATE TABLE IF NOT EXISTS` said nothing, dropping a table that was never ours, a migration that cannot be run
 * twice. None of that is visible from a fake driver, so this talks to MySQL — and skips itself, loudly, when there
 * is not one, rather than failing a suite on a machine that never claimed to have a database.
 */

const CONFIG = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 33006),
  user: process.env.MYSQL_USER ?? 'user',
  password: process.env.MYSQL_PASSWORD ?? 'password'
};

const DATABASE = process.env.MYSQL_TEST_DATABASE ?? 'plitzi_example';

/**
 * Creates the database if it is not there, which is what makes this self-sufficient: a purge, a fresh checkout or
 * a colleague's laptop all reach the same starting point. Skips — rather than fails — when there is no MySQL at
 * all, or when the user is not allowed to make one.
 */
const reachable = async (): Promise<boolean> => {
  try {
    const store = await createMysqlStore({ ...CONFIG, database: DATABASE, ensureDatabase: true, autoMigrate: false });
    await store.close();

    return true;
  } catch {
    return false;
  }
};

const available = await reachable();

/** Everything in the database right now, so a test can prove it left the rest of it alone. */
const allTables = async (pool: Pool): Promise<string[]> => {
  const rows = await selectRows<{ name: string }>(
    pool,
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'
  );

  return rows.map(row => row.name);
};

describe.skipIf(!available)('the MySQL store, against a real database', () => {
  let store: MysqlStore;

  beforeAll(async () => {
    store = await createMysqlStore({ ...CONFIG, database: DATABASE, ensureDatabase: true, autoMigrate: false });
    // A clean slate whatever the last run left, including a prefixed install from the sharing test below.
    await dropSchema(store.pool, resolveTables(), { force: true });
    await dropSchema(store.pool, resolveTables('other_'), { prefix: 'other_', force: true });
    await execute(store.pool, 'DROP TABLE IF EXISTS `unrelated_role`');
    await execute(store.pool, 'DROP TABLE IF EXISTS `role`');
  });

  afterAll(async () => {
    await dropSchema(store.pool, resolveTables(), { force: true });
    await execute(store.pool, 'DROP TABLE IF EXISTS `unrelated_role`');
    await store.close();
  });

  describe('migrating', () => {
    it('creates every table it needs and reports the version', async () => {
      expect(await migrate(store.pool, resolveTables())).toBe(store.schemaVersion);

      const present = await allTables(store.pool);
      for (const name of Object.values(tableNames())) {
        expect(present).toContain(name);
      }
    });

    /** Every boot runs it. The second one must be free, not an error. */
    it('runs twice with nothing to do the second time', async () => {
      expect(await migrate(store.pool, resolveTables())).toBe(store.schemaVersion);
      expect(await migrate(store.pool, resolveTables())).toBe(store.schemaVersion);
    });

    /**
     * The database is ahead of the code: an older process started against a schema a newer one migrated. Letting
     * it run would have it read and write rows shaped by rules it does not have.
     */
    it('refuses a database newer than the build', async () => {
      const tables = resolveTables();
      await execute(store.pool, `UPDATE ${tables.schemaVersion} SET version = ? WHERE component = 'sdk-server-auth'`, [
        store.schemaVersion + 5
      ]);

      await expect(migrate(store.pool, tables)).rejects.toThrow(/only knows/);

      await execute(store.pool, `UPDATE ${tables.schemaVersion} SET version = ? WHERE component = 'sdk-server-auth'`, [
        store.schemaVersion
      ]);
    });
  });

  describe('sharing a database with tables that are not ours', () => {
    /**
     * The reason this guard exists. `role`, `permission` and `session` are among the most ordinary table names
     * there are, and this module is explicitly meant to be pointed at a database with other things in it. Adopting
     * one would surface much later as a query against columns that are not there.
     */
    it('refuses to adopt a table it did not create', async () => {
      await dropSchema(store.pool, resolveTables(), { force: true });
      await execute(store.pool, 'CREATE TABLE `role` (`id` INT PRIMARY KEY, `unrelated` VARCHAR(10))');

      await expect(migrate(store.pool, resolveTables())).rejects.toThrow(/already has tables named/);

      // And it says what to do about it.
      await expect(migrate(store.pool, resolveTables())).rejects.toThrow(/tablePrefix/);
    });

    it('installs alongside them under a prefix', async () => {
      const prefixed = await createMysqlStore({ ...CONFIG, database: DATABASE, tablePrefix: 'other_' });

      const present = await allTables(prefixed.pool);
      expect(present).toContain('other_account');
      // The unrelated table is untouched, and still has its own shape.
      expect(present).toContain('role');
      expect(present).not.toContain('account');

      await prefixed.uninstall();
      await prefixed.close();
    });

    it('leaves the unrelated table behind when it uninstalls', async () => {
      const prefixed = await createMysqlStore({ ...CONFIG, database: DATABASE, tablePrefix: 'other_' });
      const dropped = await prefixed.uninstall();

      expect(dropped).toContain('other_account');
      expect(dropped.every(name => name.startsWith('other_'))).toBe(true);
      expect(await allTables(prefixed.pool)).toContain('role');

      await prefixed.close();
      await execute(store.pool, 'DROP TABLE IF EXISTS `role`');
    });
  });

  describe('uninstalling', () => {
    it('drops only its own tables, in an order the foreign keys allow', async () => {
      await migrate(store.pool, resolveTables());
      await execute(store.pool, 'CREATE TABLE `unrelated_role` (`id` INT PRIMARY KEY)');

      const dropped = await dropSchema(store.pool, resolveTables());
      const remaining = await allTables(store.pool);

      expect(dropped.sort()).toEqual(Object.values(tableNames()).sort());
      expect(remaining).toContain('unrelated_role');
      for (const name of Object.values(tableNames())) {
        expect(remaining).not.toContain(name);
      }
    });

    it('is a no-op on a database it was never installed into', async () => {
      expect(await dropSchema(store.pool, resolveTables())).toEqual([]);
    });

    /** Without this, a typo in `tablePrefix` turns uninstall into a tool that deletes somebody else's tables. */
    it('refuses tables that carry no schema_version of ours', async () => {
      await execute(store.pool, 'CREATE TABLE `account` (`id` INT PRIMARY KEY)');

      await expect(dropSchema(store.pool, resolveTables())).rejects.toThrow(/refusing to drop/);

      await execute(store.pool, 'DROP TABLE `account`');
    });
  });

  describe('the account cycle, on real rows', () => {
    beforeAll(async () => {
      await migrate(store.pool, resolveTables());
      await store.admin.ensureRole('member', { permissions: ['spaceRead'] });
    });

    it('stores, finds and revokes a session', async () => {
      const id = await store.admin.ensureAccount({
        username: 'itest',
        email: 'itest@example.test',
        password: 'pw',
        verified: true,
        roles: ['member']
      });

      await store.authAdapters.saveSession(
        id,
        { token: 'tok-a', expiresAt: 9999999999, refreshToken: 'ref-a', refreshExpiresAt: 9999999999 },
        { client: { userAgent: 'integration' } }
      );

      const actor = await store.authAdapters.findAccountByToken('tok-a');
      expect(actor).toMatchObject({ id, username: 'itest', permissions: ['spaceRead'] });

      const sessions = await store.sessions.list(id, 'tok-a');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({ userAgent: 'integration', current: true });

      await store.authAdapters.clearSession({ accessToken: 'tok-a' });
      expect(await store.authAdapters.findAccountByToken('tok-a')).toBeUndefined();
    });

    it('replaces a session on renewal instead of adding one', async () => {
      const id = await store.admin.ensureAccount({ username: 'itest2', email: 'itest2@example.test', password: 'pw' });

      await store.authAdapters.saveSession(id, { token: 't1', expiresAt: 9999999999, refreshToken: 'r1' });
      await store.authAdapters.saveSession(
        id,
        { token: 't2', expiresAt: 9999999999, refreshToken: 'r2' },
        { replaces: { refreshToken: 'r1' } }
      );

      expect(await store.sessions.list(id)).toHaveLength(1);
      expect(await store.authAdapters.findAccountByToken('t1')).toBeUndefined();
      expect(await store.authAdapters.findAccountByToken('t2')).toBeDefined();
    });

    it('takes an account’s sessions with it when the account goes', async () => {
      const id = await store.admin.ensureAccount({ username: 'itest3', email: 'itest3@example.test', password: 'pw' });
      await store.authAdapters.saveSession(id, { token: 't3', expiresAt: 9999999999 });

      await store.authAdapters.deleteAccount?.(id);

      expect(await store.sessions.list(id)).toEqual([]);
      expect(await store.authAdapters.findAccountByToken('t3')).toBeUndefined();
    });

    it('refuses a session held by a suspended account', async () => {
      const id = await store.admin.ensureAccount({ username: 'itest4', email: 'itest4@example.test', password: 'pw' });
      await store.authAdapters.saveSession(id, { token: 't4', expiresAt: 9999999999 });

      await store.authAdapters.setStatus?.(id, 'blocked');

      expect(await store.authAdapters.findAccountByToken('t4')).toBeUndefined();
    });

    it('searches accounts without tripping over LIKE wildcards', async () => {
      await store.admin.ensureAccount({ username: 'per%cent', email: 'percent@example.test' });

      const wildcard = await store.authAdapters.listAccounts?.({ search: '%' });
      const literal = await store.authAdapters.listAccounts?.({ search: 'per%cent' });

      // `%` is escaped, so it matches the one account whose name contains it — not every account.
      expect(wildcard?.accounts.map(account => account.username)).toEqual(['per%cent']);
      expect(literal?.accounts).toHaveLength(1);
    });
  });
});
