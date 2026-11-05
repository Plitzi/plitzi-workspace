import { leftByGoneRun, runName } from './runNames';
import { execute, selectRows } from '../mysql/query';

import type { Pool } from 'mysql2/promise';

const tablesStarting = async (pool: Pool, start: string): Promise<string[]> => {
  const rows = await selectRows<{ name: string }>(
    pool,
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ?',
    [`${start.replace(/[\\%_]/g, character => `\\${character}`)}%`]
  );

  return rows.map(row => row.name);
};

const dropTables = async (pool: Pool, names: readonly string[]): Promise<void> => {
  if (names.length === 0) {
    return;
  }

  // Their foreign keys point at one another: one statement, with the checks off for the connection that runs it. `IF
  // EXISTS`: two runs starting together sweep the same leftovers, and the second finds them gone.
  const connection = await pool.getConnection();
  try {
    await execute(connection, 'SET FOREIGN_KEY_CHECKS = 0');
    await execute(connection, `DROP TABLE IF EXISTS ${names.map(name => `\`${name}\``).join(', ')}`);
    await execute(connection, 'SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
};

/** The tables a run killed before its `afterAll` left under its `runName(base)`: dropped, and named. */
export const dropTablesOfGoneRuns = async (pool: Pool, base: string): Promise<string[]> => {
  const gone = (await tablesStarting(pool, `${base}_`)).filter(name => leftByGoneRun(name, base));
  await dropTables(pool, gone);

  return gone;
};

/** Every table this run made under its `runName(base)`, whatever a test created and did not drop. */
export const dropTablesOfThisRun = async (pool: Pool, base: string): Promise<void> => {
  await dropTables(pool, await tablesStarting(pool, `${runName(base)}_`));
};
