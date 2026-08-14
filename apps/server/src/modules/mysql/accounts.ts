import { execute, selectOne, selectRows } from './query';
import { createSessionStore } from './sessions';

import type { Tables } from './config';
import type { Queryable } from './query';
import type {
  AccountAccess,
  AccountAdapters,
  AccountQuery,
  AccountRecord,
  AccountStatus,
  SessionContext
} from '../../core/auth/api';
import type { Actor, IdentityAdapters, SpaceMembership, StoredSpaceToken } from '../../core/auth/identity';
import type { SpaceScope } from '../../core/auth/tokens';
import type { SSRSession } from '@plitzi/sdk-shared';

interface AccountRow {
  id: number;
  username: string;
  email: string;
  password_hash: string | null;
  status: string;
  verified: number;
  /** Joined from the session this lookup came in on, where there is one. */
  session_expires_at?: number | null;
  refresh_expires_at?: number | null;
}

const ACCOUNT_COLUMNS = 'a.id, a.username, a.email, a.password_hash, a.status, a.verified';

const toRecord = (row: AccountRow): AccountRecord => ({
  id: row.id,
  username: row.username,
  email: row.email,
  active: row.status === 'active',
  verified: row.verified === 1,
  ...(row.password_hash ? { passwordHash: row.password_hash } : {}),
  ...(row.refresh_expires_at !== null && row.refresh_expires_at !== undefined
    ? { refreshExpiresAt: row.refresh_expires_at }
    : {})
});

/**
 * An opaque single-use token, as a lookup key. Empty is not one.
 *
 * Clearing a reset token is written as `setResetToken(userId, '')` — the flows say so — and an empty string stored
 * as an empty string is a value that MATCHES: one lookup would then return whichever account was cleared first, and
 * a password-reset link with no token in it would work. Stored as NULL, and never looked up when blank.
 */
const asLookup = (token: string): string | undefined => (token.trim() === '' ? undefined : token);

const accessRows = (rows: { role: string; permission: string | null }[]): AccountAccess => {
  const roles = new Set<string>();
  const permissions = new Set<string>();

  for (const row of rows) {
    roles.add(row.role);
    if (row.permission) {
      permissions.add(row.permission);
    }
  }

  return { roles: [...roles], permissions: [...permissions] };
};

export const createAccountStore = (db: Queryable, t: Tables): IdentityAdapters & AccountAdapters => {
  const sessions = createSessionStore(db, t);

  const findBy = (column: string, value: unknown): Promise<AccountRow | undefined> =>
    selectOne<AccountRow>(db, `SELECT ${ACCOUNT_COLUMNS} FROM ${t.account} a WHERE a.${column} = ? LIMIT 1`, [value]);

  const loadAccess = async (userId: number): Promise<AccountAccess> =>
    accessRows(
      await selectRows<{ role: string; permission: string | null }>(
        db,
        `SELECT r.name AS role, p.name AS permission
           FROM ${t.accountRole} ar
           JOIN ${t.role} r ON r.id = ar.role_id
           LEFT JOIN ${t.rolePermission} rp ON rp.role_id = r.id
           LEFT JOIN ${t.permission} p ON p.id = rp.permission_id
          WHERE ar.account_id = ?`,
        [userId]
      )
    );

  return {
    /**
     * Looked up BY THE TOKEN, which is what makes a session revocable: writing a new pair over the row retires the
     * previous one, so a credential that no longer matches is dead however valid its signature still is.
     *
     * A suspended account resolves to nothing at all rather than to an actor the caller then has to remember to
     * check — deactivating somebody has to end the session they are already holding, not just the next login.
     */
    findAccountByToken: async (token: string): Promise<Actor | undefined> => {
      const row = await selectOne<AccountRow>(
        db,
        `SELECT ${ACCOUNT_COLUMNS}, s.expires_at AS session_expires_at
           FROM ${t.session} s
           JOIN ${t.account} a ON a.id = s.account_id
          WHERE s.token = ? AND a.status = 'active'
          LIMIT 1`,
        [token]
      );

      if (!row) {
        return undefined;
      }

      const { roles, permissions } = await loadAccess(row.id);

      return {
        id: row.id,
        username: row.username,
        email: row.email,
        verified: row.verified === 1,
        roles,
        permissions,
        token,
        expiresAt: row.session_expires_at ?? 0
      };
    },

    findSpaceToken: async (token: string): Promise<StoredSpaceToken | undefined> => {
      const row = await selectOne<{ space_id: number; scope: SpaceScope; account_id: number | null }>(
        db,
        `SELECT space_id, scope, account_id FROM ${t.spaceToken} WHERE token = ? LIMIT 1`,
        [token]
      );

      if (!row) {
        return undefined;
      }

      return {
        spaceId: row.space_id,
        scope: row.scope,
        ...(row.account_id !== null ? { userId: row.account_id } : {})
      };
    },

    findMembership: async (userId: number, spaceId: number): Promise<SpaceMembership | undefined> => {
      const rows = await selectRows<{ is_owner: number; role: string; permission: string | null }>(
        db,
        `SELECT sm.is_owner, r.name AS role, p.name AS permission
           FROM ${t.spaceMember} sm
           JOIN ${t.role} r ON r.id = sm.role_id
           LEFT JOIN ${t.rolePermission} rp ON rp.role_id = r.id
           LEFT JOIN ${t.permission} p ON p.id = rp.permission_id
          WHERE sm.account_id = ? AND sm.space_id = ?`,
        [userId, spaceId]
      );

      if (rows.length === 0) {
        return undefined;
      }

      const { roles, permissions } = accessRows(rows);

      return { spaceId, isOwner: rows[0].is_owner === 1, role: roles[0], permissions };
    },

    loadAccess,

    /**
     * A sign-in adds a session; a renewal replaces the one it names.
     *
     * The replace is an UPDATE on purpose, not a delete-then-insert: it keeps the row's identity, so the device
     * somebody sees in their session list is still the same device after it renews, and a session revoked in the
     * instant between the two cannot come back. When the update matches nothing — the session was revoked while
     * this renewal was in flight — **no row is written**. The caller walks away with a credential that is not
     * stored, which is a signed-out user rather than a revoked session resurrected.
     */
    saveSession: async (userId: number, session: SSRSession, context?: SessionContext): Promise<void> => {
      const replaces = context?.replaces;

      if (replaces?.refreshToken !== undefined || replaces?.accessToken !== undefined) {
        const column = replaces.refreshToken !== undefined ? 'refresh_token' : 'token';
        const value = replaces.refreshToken ?? replaces.accessToken;

        await execute(
          db,
          `UPDATE ${t.session}
              SET token = ?, expires_at = ?, refresh_token = ?, refresh_expires_at = ?
            WHERE ${column} = ? AND account_id = ?`,
          [
            session.token,
            session.expiresAt,
            session.refreshToken ?? null,
            session.refreshExpiresAt ?? null,
            value,
            userId
          ]
        );

        return;
      }

      await execute(
        db,
        `INSERT INTO ${t.session} (account_id, token, expires_at, refresh_token, refresh_expires_at, user_agent, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          session.token,
          session.expiresAt,
          session.refreshToken ?? null,
          session.refreshExpiresAt ?? null,
          // Truncated rather than refused: a browser that sends a 4KB user agent has not done anything wrong, and
          // failing a sign-in over a label nobody reads would be absurd.
          context?.client?.userAgent?.slice(0, 255) ?? null,
          context?.client?.ip ?? null
        ]
      );
    },

    /**
     * By whichever half the caller is holding, or every session of an account.
     *
     * An empty target clears NOTHING — a `WHERE` assembled from no conditions is a `WHERE` that matches every row,
     * and the statement that would sign out an entire deployment must not be reachable by leaving an argument off.
     */
    clearSession: async (target: { accessToken?: string; refreshToken?: string; userId?: number }): Promise<void> => {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (target.userId !== undefined) {
        conditions.push('account_id = ?');
        params.push(target.userId);
      }

      if (target.accessToken !== undefined) {
        conditions.push('token = ?');
        params.push(target.accessToken);
      }

      if (target.refreshToken !== undefined) {
        conditions.push('refresh_token = ?');
        params.push(target.refreshToken);
      }

      if (conditions.length === 0) {
        return;
      }

      await execute(db, `DELETE FROM ${t.session} WHERE ${conditions.join(' OR ')}`, params);
    },

    findByUsername: async (username: string): Promise<AccountRecord | undefined> => {
      const row = await findBy('username', username);

      return row ? toRecord(row) : undefined;
    },

    findByEmail: async (email: string): Promise<AccountRecord | undefined> => {
      const row = await findBy('email', email);

      return row ? toRecord(row) : undefined;
    },

    /**
     * `refreshExpiresAt` comes off the ROW. A store that keeps it inside a session object and forgets to lift it out
     * has every renewal refused as expired — which does not fail at login, it fails a day later, silently, when the
     * access token ages out and the session that looked fine simply ends.
     */
    findByRefreshToken: async (token: string): Promise<AccountRecord | undefined> => {
      const row = await selectOne<AccountRow>(
        db,
        `SELECT ${ACCOUNT_COLUMNS}, s.refresh_expires_at
           FROM ${t.session} s
           JOIN ${t.account} a ON a.id = s.account_id
          WHERE s.refresh_token = ?
          LIMIT 1`,
        [token]
      );

      return row ? toRecord(row) : undefined;
    },

    createAccount: async (account: {
      username: string;
      email: string;
      passwordHash: string;
    }): Promise<AccountRecord> => {
      const result = await execute(db, `INSERT INTO ${t.account} (username, email, password_hash) VALUES (?, ?, ?)`, [
        account.username,
        account.email,
        account.passwordHash
      ]);

      return {
        id: result.insertId,
        username: account.username,
        email: account.email,
        active: true,
        verified: false,
        passwordHash: account.passwordHash
      };
    },

    setPassword: async (userId: number, passwordHash: string): Promise<void> => {
      await execute(db, `UPDATE ${t.account} SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
    },

    setResetToken: async (userId: number, token: string): Promise<void> => {
      await execute(db, `UPDATE ${t.account} SET reset_token = ? WHERE id = ?`, [asLookup(token) ?? null, userId]);
    },

    findByResetToken: async (token: string): Promise<AccountRecord | undefined> => {
      const lookup = asLookup(token);
      if (!lookup) {
        return undefined;
      }

      const row = await findBy('reset_token', lookup);

      return row ? toRecord(row) : undefined;
    },

    setValidationToken: async (userId: number, token: string): Promise<void> => {
      await execute(db, `UPDATE ${t.account} SET validation_token = ? WHERE id = ?`, [asLookup(token) ?? null, userId]);
    },

    findByValidationToken: async (token: string): Promise<AccountRecord | undefined> => {
      const lookup = asLookup(token);
      if (!lookup) {
        return undefined;
      }

      const row = await findBy('validation_token', lookup);

      return row ? toRecord(row) : undefined;
    },

    markVerified: async (userId: number): Promise<void> => {
      await execute(db, `UPDATE ${t.account} SET verified = 1, validation_token = NULL WHERE id = ?`, [userId]);
    },

    findById: async (userId: number): Promise<AccountRecord | undefined> => {
      const row = await findBy('id', userId);

      return row ? toRecord(row) : undefined;
    },

    /**
     * Only the columns the caller named. A blanket UPDATE cannot tell "leave the email alone" from "clear it", and
     * a profile form that posts one field would wipe the other.
     */
    updateAccount: async (userId: number, changes: { username?: string; email?: string }): Promise<AccountRecord> => {
      const columns: string[] = [];
      const params: unknown[] = [];

      if (changes.username !== undefined) {
        columns.push('username = ?');
        params.push(changes.username);
      }

      if (changes.email !== undefined) {
        columns.push('email = ?');
        params.push(changes.email);
      }

      if (columns.length > 0) {
        await execute(db, `UPDATE ${t.account} SET ${columns.join(', ')} WHERE id = ?`, [...params, userId]);
      }

      const row = await findBy('id', userId);
      if (!row) {
        throw new Error(`@plitzi/sdk-server/mysql: account ${userId} disappeared while being updated.`);
      }

      return toRecord(row);
    },

    setStatus: async (userId: number, status: AccountStatus): Promise<void> => {
      await execute(db, `UPDATE ${t.account} SET status = ? WHERE id = ?`, [status, userId]);
    },

    /**
     * The row goes, and its sessions with it — the foreign key cascades, so there is no window in which a deleted
     * account still has a working credential. A deployment that has to keep the row for its content or its invoices
     * replaces this adapter with one that anonymises instead; the sessions still have to go.
     */
    deleteAccount: async (userId: number): Promise<void> => {
      await execute(db, `DELETE FROM ${t.account} WHERE id = ?`, [userId]);
    },

    listAccounts: async (query: AccountQuery): Promise<{ accounts: AccountRecord[]; total: number }> => {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.search) {
        conditions.push('(a.username LIKE ? OR a.email LIKE ?)');
        // Escaped, or a search for `100%` matches every account and one for `_` matches all of them too.
        const like = `%${query.search.replace(/[%_\\]/g, character => `\\${character}`)}%`;
        params.push(like, like);
      }

      if (query.status) {
        conditions.push('a.status = ?');
        params.push(query.status);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
      const offset = Math.max(query.offset ?? 0, 0);

      const counted = await selectOne<{ total: number }>(
        db,
        `SELECT COUNT(*) AS total FROM ${t.account} a ${where}`,
        params
      );

      const rows = await selectRows<AccountRow>(
        db,
        `SELECT ${ACCOUNT_COLUMNS} FROM ${t.account} a ${where} ORDER BY a.id ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return { accounts: rows.map(toRecord), total: counted?.total ?? 0 };
    },

    /** Exactly these roles, which means the ones not named are taken away. Unknown names are ignored, not created. */
    setRoles: async (userId: number, roles: string[]): Promise<void> => {
      await execute(db, `DELETE FROM ${t.accountRole} WHERE account_id = ?`, [userId]);

      if (roles.length === 0) {
        return;
      }

      const placeholders = roles.map(() => '?').join(', ');
      await execute(
        db,
        `INSERT INTO ${t.accountRole} (account_id, role_id)
         SELECT ?, id FROM ${t.role} WHERE name IN (${placeholders})`,
        [userId, ...roles]
      );
    },

    listSessions: (userId: number, currentToken?: string) => sessions.list(userId, currentToken),
    revokeSession: (userId: number, sessionId: number) => sessions.revoke(userId, sessionId),
    revokeOtherSessions: (userId: number, currentToken: string) => sessions.revokeOthers(userId, currentToken)
  };
};
