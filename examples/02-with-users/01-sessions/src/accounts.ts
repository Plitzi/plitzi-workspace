import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AccountAdapters, AccountRecord, IdentityAdapters } from '@plitzi/sdk-server/auth';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * An account store, in memory.
 *
 * This is the part that is yours. A real deployment reads rows from Postgres, MySQL, Mongo or an identity service;
 * what the server needs from any of them is the handful of functions below, and it never learns which you chose.
 * Everything else — how a session travels, when it renews, what a 401 means — is the server's, already decided.
 */

type Row = AccountRecord & { session?: SSRSession };

const hash = (password: string): string => {
  const salt = randomBytes(16).toString('hex');

  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

const verify = (password: string, stored: string): boolean => {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) {
    return false;
  }

  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, expected.length);

  return timingSafeEqual(expected, actual);
};

// Two accounts, so the example can show the difference between "signed in" and "signed in as somebody who may edit".
const rows: Row[] = [
  {
    id: 1,
    username: 'ada',
    email: 'ada@example.test',
    active: true,
    verified: true,
    passwordHash: hash('password')
  },
  {
    id: 2,
    username: 'grace',
    email: 'grace@example.test',
    active: true,
    verified: true,
    passwordHash: hash('password')
  }
];

const ACCESS: Record<number, { roles: string[]; permissions: string[] }> = {
  1: { roles: ['editor'], permissions: ['spaceUpdate'] },
  2: { roles: ['viewer'], permissions: [] }
};

const find = (predicate: (row: Row) => boolean): Row | undefined => rows.find(predicate);

export const accounts: IdentityAdapters & AccountAdapters = {
  /**
   * Looked up BY THE TOKEN, not by user id. Storing the current session on the row is what makes signing out
   * actually sign somebody out: a token that no longer matches a row is dead, however valid its signature is.
   */
  findAccountByToken: token => {
    const row = find(candidate => candidate.session?.token === token);

    return Promise.resolve(
      row
        ? {
            id: row.id,
            username: row.username,
            email: row.email,
            verified: row.verified,
            ...ACCESS[row.id],
            token,
            expiresAt: row.session?.expiresAt ?? 0
          }
        : undefined
    );
  },

  findByUsername: username => Promise.resolve(find(row => row.username === username)),

  /** Storing the new pair retires the previous one. That is the whole of session rotation. */
  saveSession: (userId, session) => {
    const row = find(candidate => candidate.id === userId);
    if (row) {
      row.session = session;
    }

    return Promise.resolve();
  },

  clearSession: target => {
    const row = find(
      candidate =>
        (target.userId !== undefined && candidate.id === target.userId) ||
        (target.accessToken !== undefined && candidate.session?.token === target.accessToken) ||
        (target.refreshToken !== undefined && candidate.session?.refreshToken === target.refreshToken)
    );
    if (row) {
      row.session = undefined;
    }

    return Promise.resolve();
  },

  loadAccess: userId => Promise.resolve(ACCESS[userId] ?? { roles: [], permissions: [] }),

  /**
   * Note `refreshExpiresAt`: the server asks the account when its renewal credential dies, and a store that keeps
   * that inside a session object has to lift it out. Leave it off and every renewal is refused as expired — the
   * session works until the access token ages out and then quietly ends.
   */
  findByRefreshToken: token => {
    const row = find(candidate => candidate.session?.refreshToken === token);

    return Promise.resolve(row ? { ...row, refreshExpiresAt: row.session?.refreshExpiresAt } : undefined);
  }
};

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  Promise.resolve(verify(password, stored));
