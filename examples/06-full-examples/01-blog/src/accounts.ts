import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AccountAdapters, AccountRecord, IdentityAdapters } from '@plitzi/sdk-server/auth';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * Two people, in memory.
 *
 * Same shape as [02-with-users/01-sessions], which is where this is explained properly — the store is yours, and
 * these six functions are all the server ever asks of it. What matters HERE is the last field: `ada` holds
 * `postPublish` and `grace` does not, and that single difference is the whole of who may write on this blog.
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

  return timingSafeEqual(expected, scryptSync(password, salt, expected.length));
};

const rows: Row[] = [
  { id: 1, username: 'ada', email: 'ada@example.test', active: true, verified: true, passwordHash: hash('password') },
  { id: 2, username: 'grace', email: 'grace@example.test', active: true, verified: true, passwordHash: hash('password') }
];

/**
 * A permission is a capability of the ACCOUNT, and the action names the one it needs. Neither half knows about
 * the other: the blog decided `postPublish` exists, and the store decided who has it.
 */
const ACCESS: Record<number, { roles: string[]; permissions: string[] }> = {
  1: { roles: ['author'], permissions: ['postPublish'] },
  2: { roles: ['reader'], permissions: [] }
};

const find = (predicate: (row: Row) => boolean): Row | undefined => rows.find(predicate);

export const accounts: IdentityAdapters & AccountAdapters = {
  /** By the TOKEN, not by user id: a token that no longer matches a row is dead, however valid its signature. */
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

  findByRefreshToken: token => {
    const row = find(candidate => candidate.session?.refreshToken === token);

    return Promise.resolve(row ? { ...row, refreshExpiresAt: row.session?.refreshExpiresAt } : undefined);
  }
};

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  Promise.resolve(verify(password, stored));
