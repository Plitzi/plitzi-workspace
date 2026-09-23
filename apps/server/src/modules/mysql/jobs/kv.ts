import { ensureJobTables, jobTables, NOW_MS } from './schema';
import { execute, selectOne } from '../query';

import type { ActionKvAdapter } from '../../actions/types';
import type { Pool } from 'mysql2/promise';

export type MysqlKvOptions = {
  /** A pool the deployment opened. Never ended here. */
  pool: Pool;
  /** Same prefix as the job queue's, when both are used: the three tables are created together. */
  tablePrefix?: string;
  /** Create the tables on first use. Default true. */
  createTables?: boolean;
};

/** Alive by the SERVER's clock: a key past its lifetime answers nothing, whether or not it has been removed yet. */
const LIVE = `(expires_at IS NULL OR expires_at > ${NOW_MS})`;

/**
 * An {@link ActionKvAdapter} over a table in a MySQL database the deployment owns.
 *
 * What the run guards' single-flight keys and the `kv` tasks' counters need from a store the replicas share: a TTL the
 * store enforces and an increment nobody can race. The increment is one `INSERT … ON DUPLICATE KEY UPDATE`, which
 * MySQL applies to the row under its lock — so two replicas counting at once both count.
 */
export const createMysqlKv = ({ pool, tablePrefix = '', createTables = true }: MysqlKvOptions): ActionKvAdapter => {
  const { kv } = jobTables(tablePrefix);
  const ready = ensureJobTables(pool, tablePrefix, createTables);

  const db = async (): Promise<Pool> => {
    await ready();

    return pool;
  };

  /** Expired rows are removed as they are overwritten or read past; a table of used-once keys is swept here too. */
  let sweptAt = 0;
  const sweep = async (): Promise<void> => {
    if (Date.now() - sweptAt < 60_000) {
      return;
    }

    sweptAt = Date.now();
    await execute(pool, `DELETE FROM ${kv} WHERE expires_at IS NOT NULL AND expires_at <= ${NOW_MS} LIMIT 1000`);
  };

  return {
    get: async key => {
      const row = await selectOne<{ v: string }>(await db(), `SELECT v FROM ${kv} WHERE k = ? AND ${LIVE}`, [key]);

      return row?.v;
    },

    set: async (key, value, ttlSeconds) => {
      const expiry = ttlSeconds === undefined ? 'NULL' : `${NOW_MS} + ?`;
      await execute(
        await db(),
        `INSERT INTO ${kv} (k, v, expires_at) VALUES (?, ?, ${expiry})
        ON DUPLICATE KEY UPDATE v = VALUES(v), expires_at = VALUES(expires_at)`,
        ttlSeconds === undefined ? [key, value] : [key, value, ttlSeconds * 1000]
      );
      await sweep();
    },

    delete: async key => {
      await execute(await db(), `DELETE FROM ${kv} WHERE k = ?`, [key]);
    },

    increment: async (key, amount) => {
      const connection = await (await db()).getConnection();
      try {
        await connection.beginTransaction();
        /**
         * `v` FIRST: the assignments run left to right and each sees the ones before it, so the value has to be
         * computed while `expires_at` still says whether the old one is alive. A lapsed counter starts again from
         * zero, and without the lifetime it had. `+ 0` reads the text as a number, as Redis reads its strings.
         */
        await execute(
          connection,
          `INSERT INTO ${kv} (k, v, expires_at) VALUES (?, CAST(? AS CHAR), NULL)
          ON DUPLICATE KEY UPDATE
            v = CAST(IF(${LIVE}, (v + 0) + ?, ?) AS CHAR),
            expires_at = IF(${LIVE}, expires_at, NULL)`,
          [key, amount, amount, amount]
        );
        const row = await selectOne<{ v: string }>(connection, `SELECT v FROM ${kv} WHERE k = ?`, [key]);
        await connection.commit();

        return Number(row?.v ?? amount);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    expire: async (key, ttlSeconds) => {
      await execute(await db(), `UPDATE ${kv} SET expires_at = ${NOW_MS} + ? WHERE k = ? AND ${LIVE}`, [
        ttlSeconds * 1000,
        key
      ]);
    }
  };
};
