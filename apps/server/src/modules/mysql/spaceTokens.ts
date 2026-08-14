import { execute, selectOne, selectRows } from './query';

import type { Tables } from './config';
import type { Queryable } from './query';
import type { SpaceTokenAdapters, SpaceTokenRecord } from '../../core/auth/spaceTokens';
import type { SpaceScope } from '../../core/auth/tokens';

interface SpaceTokenRow {
  id: number;
  token: string;
  scope: SpaceScope;
  is_default: number;
  origins: string | null;
  expires_at: number | null;
  account_id: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, token, scope, is_default, origins, expires_at, account_id, created_at, updated_at';

const seconds = (value: Date): number => Math.floor(value.getTime() / 1000);

const toRecord = (row: SpaceTokenRow): SpaceTokenRecord => ({
  id: row.id,
  token: row.token,
  scope: row.scope,
  isDefault: row.is_default === 1,
  origins: (row.origins ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean),
  expiresAt: row.expires_at,
  userId: row.account_id,
  createdAt: seconds(row.created_at),
  updatedAt: seconds(row.updated_at)
});

/**
 * The stored half of a space credential.
 *
 * Note what is NOT here: nothing creates a row. The space-token API rotates, re-scopes and revokes credentials for
 * a space that already has one, and issuing a space's first credential happens when the space itself is created —
 * which is the deployment's event, not auth's. `createSpaceToken` on the store's `admin` surface does it.
 */
export const createSpaceTokenStore = (db: Queryable, t: Tables): SpaceTokenAdapters => ({
  loadDefault: async (spaceId: number): Promise<SpaceTokenRecord | undefined> => {
    const row = await selectOne<SpaceTokenRow>(
      db,
      `SELECT ${COLUMNS} FROM ${t.spaceToken} WHERE space_id = ? AND is_default = 1 LIMIT 1`,
      [spaceId]
    );

    return row ? toRecord(row) : undefined;
  },

  /** Scoped by space as well as id: a token id from another space must not resolve, or it is an IDOR. */
  find: async (spaceId: number, tokenId: number): Promise<SpaceTokenRecord | undefined> => {
    const row = await selectOne<SpaceTokenRow>(
      db,
      `SELECT ${COLUMNS} FROM ${t.spaceToken} WHERE space_id = ? AND id = ? LIMIT 1`,
      [spaceId, tokenId]
    );

    return row ? toRecord(row) : undefined;
  },

  list: async (spaceId: number): Promise<SpaceTokenRecord[]> => {
    const rows = await selectRows<SpaceTokenRow>(
      db,
      `SELECT ${COLUMNS} FROM ${t.spaceToken} WHERE space_id = ? ORDER BY is_default DESC, id ASC`,
      [spaceId]
    );

    return rows.map(toRecord);
  },

  /**
   * Only the fields the caller named. `origins` and `expiresAt` are each meaningful as "unchanged" and as "cleared",
   * and a blanket UPDATE cannot tell those apart — it would wipe a domain list on every plain rotation.
   */
  save: async (id: number, values: { token: string; origins?: string[]; expiresAt?: number | null }): Promise<void> => {
    const columns = ['token = ?'];
    const params: unknown[] = [values.token];

    if (values.origins !== undefined) {
      columns.push('origins = ?');
      params.push(values.origins.join(','));
    }

    if (values.expiresAt !== undefined) {
      columns.push('expires_at = ?');
      params.push(values.expiresAt);
    }

    params.push(id);

    await execute(db, `UPDATE ${t.spaceToken} SET ${columns.join(', ')} WHERE id = ?`, params);
  },

  remove: async (id: number): Promise<void> => {
    await execute(db, `DELETE FROM ${t.spaceToken} WHERE id = ?`, [id]);
  }
});
