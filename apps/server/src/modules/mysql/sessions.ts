import { execute, selectRows } from './query';

import type { Tables } from './config';
import type { Queryable } from './query';

/** One signed-in device, as somebody looking at their own account should see it. Never the credential itself. */
export interface SessionSummary {
  id: number;
  userAgent?: string;
  ip?: string;
  /** Unix seconds. */
  createdAt: number;
  expiresAt: number;
  /** This is the session asking. A device list without it invites someone to revoke the one they are using. */
  current: boolean;
}

interface SessionRow {
  id: number;
  token: string;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
  expires_at: number;
}

/**
 * The sessions of one account, as a thing that can be looked at and taken away one at a time.
 *
 * This is what a `session` table buys over a token pair on the account row, and it is the whole reason to pay for
 * it: somebody who left themselves signed in on a machine they no longer have can end that session and keep the
 * ones they are using. Revoking everything is `clearSession({ userId })` and is a blunter instrument.
 */
export const createSessionStore = (db: Queryable, t: Tables) => {
  const list = async (accountId: number, currentToken?: string): Promise<SessionSummary[]> => {
    const rows = await selectRows<SessionRow>(
      db,
      `SELECT id, token, user_agent, ip, created_at, expires_at
         FROM ${t.session}
        WHERE account_id = ?
        ORDER BY created_at DESC`,
      [accountId]
    );

    return rows.map(row => ({
      id: row.id,
      ...(row.user_agent ? { userAgent: row.user_agent } : {}),
      ...(row.ip ? { ip: row.ip } : {}),
      createdAt: Math.floor(row.created_at.getTime() / 1000),
      expiresAt: row.expires_at,
      current: currentToken !== undefined && row.token === currentToken
    }));
  };

  return {
    list,

    /** Scoped by account as well as id, or one account could end another's session by guessing a number. */
    revoke: async (accountId: number, sessionId: number): Promise<boolean> => {
      const result = await execute(db, `DELETE FROM ${t.session} WHERE id = ? AND account_id = ?`, [
        sessionId,
        accountId
      ]);

      return result.affectedRows > 0;
    },

    /** "Sign out everywhere else" — the one thing to do from a device you still trust after losing one you do not. */
    revokeOthers: async (accountId: number, currentToken: string): Promise<number> => {
      const result = await execute(db, `DELETE FROM ${t.session} WHERE account_id = ? AND token <> ?`, [
        accountId,
        currentToken
      ]);

      return result.affectedRows;
    },

    /**
     * Delete what has aged out. Nothing depends on this for correctness — an expired session is refused by its
     * expiry, not by its absence — so it is housekeeping a deployment schedules, not a step in any request.
     */
    purgeExpired: async (): Promise<number> => {
      const now = Math.floor(Date.now() / 1000);
      const result = await execute(
        db,
        `DELETE FROM ${t.session}
          WHERE expires_at < ? AND (refresh_expires_at IS NULL OR refresh_expires_at < ?)`,
        [now, now]
      );

      return result.affectedRows;
    }
  };
};

export type SessionStore = ReturnType<typeof createSessionStore>;
