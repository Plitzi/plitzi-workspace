import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type Queryable = Pool | PoolConnection;

/**
 * The driver boundary, in one place.
 *
 * A row arrives as `RowDataPacket` — an index signature over `unknown`, which is all the driver can honestly say
 * about a result set it has not been told the shape of. Naming that shape is a cast whichever way it is written, so
 * it is written once, here, rather than at each of the thirty call sites that would otherwise each carry one.
 */
export const selectRows = async <T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);

  return rows as T[];
};

export const selectOne = async <T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T | undefined> => {
  const rows = await selectRows<T>(db, sql, params);

  return rows[0];
};

export const execute = async (db: Queryable, sql: string, params: unknown[] = []): Promise<ResultSetHeader> => {
  const [result] = await db.query<ResultSetHeader>(sql, params);

  return result;
};
