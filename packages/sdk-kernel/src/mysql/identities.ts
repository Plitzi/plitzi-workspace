import { execute, selectOne, selectRows } from './query';

import type { Tables } from './config';
import type { Queryable } from './query';

/** The same person at somebody else's identity provider. */
export interface LinkedIdentity {
  id: number;
  provider: string;
  subject: string;
  email?: string;
  createdAt: number;
}

/**
 * External identities, as rows.
 *
 * Deliberately NOT part of the auth adapters: whether a Google account with a matching email is the same person is
 * a judgement only a deployment can make, and it lives in `exchangeCredential` / the social `linkAccount` hook.
 * What is mechanical is the storage, and a self-hoster should not have to design the table for it.
 *
 * The unique key is `(provider, subject)`, never the email. A provider that does not verify addresses lets anybody
 * claim any account by signing up with one — which is the single most common way social linking is got wrong.
 */
export const createIdentityStore = (db: Queryable, t: Tables) => ({
  find: async (provider: string, subject: string): Promise<{ accountId: number } | undefined> => {
    const row = await selectOne<{ account_id: number }>(
      db,
      `SELECT account_id FROM ${t.identity} WHERE provider = ? AND subject = ? LIMIT 1`,
      [provider, subject]
    );

    return row ? { accountId: row.account_id } : undefined;
  },

  /** Idempotent: signing in again with the same provider identity must not be an error. */
  link: async (accountId: number, identity: { provider: string; subject: string; email?: string }): Promise<void> => {
    await execute(
      db,
      `INSERT INTO ${t.identity} (account_id, provider, subject, email) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE account_id = VALUES(account_id), email = VALUES(email)`,
      [accountId, identity.provider, identity.subject, identity.email ?? null]
    );
  },

  list: async (accountId: number): Promise<LinkedIdentity[]> => {
    const rows = await selectRows<{
      id: number;
      provider: string;
      subject: string;
      email: string | null;
      created_at: Date;
    }>(db, `SELECT id, provider, subject, email, created_at FROM ${t.identity} WHERE account_id = ? ORDER BY id ASC`, [
      accountId
    ]);

    return rows.map(row => ({
      id: row.id,
      provider: row.provider,
      subject: row.subject,
      ...(row.email ? { email: row.email } : {}),
      createdAt: Math.floor(row.created_at.getTime() / 1000)
    }));
  },

  /** Scoped by account, or one person could unlink another's provider by guessing a number. */
  unlink: async (accountId: number, provider: string): Promise<boolean> => {
    const result = await execute(db, `DELETE FROM ${t.identity} WHERE account_id = ? AND provider = ?`, [
      accountId,
      provider
    ]);

    return result.affectedRows > 0;
  }
});

export type IdentityStore = ReturnType<typeof createIdentityStore>;
