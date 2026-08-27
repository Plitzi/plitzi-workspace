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

/**
 * One account, and every session it has open.
 *
 * A LIST, not a single pair — which is the difference between a store you can demonstrate and one that logs the
 * laptop out when the phone signs in. The sibling example [02-with-users/01-sessions] keeps one, and says so.
 */
type Row = AccountRecord & { sessions: SSRSession[] };

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
  {
    id: 1,
    username: 'ada',
    email: 'ada@example.test',
    active: true,
    verified: true,
    passwordHash: hash('password'),
    sessions: []
  },
  {
    id: 2,
    username: 'grace',
    email: 'grace@example.test',
    active: true,
    verified: true,
    passwordHash: hash('password'),
    sessions: []
  }
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
  /** By the TOKEN, not by user id: a token that no longer matches a session is dead, however valid its signature. */
  findAccountByToken: token => {
    const row = find(candidate => candidate.sessions.some(session => session.token === token));
    const session = row?.sessions.find(item => item.token === token);

    return Promise.resolve(
      row
        ? {
            id: row.id,
            username: row.username,
            email: row.email,
            verified: row.verified,
            ...ACCESS[row.id],
            token,
            expiresAt: session?.expiresAt ?? 0
          }
        : undefined
    );
  },

  findByUsername: username => Promise.resolve(find(row => row.username === username)),

  /**
   * A sign-in ADDS a session; a renewal REPLACES the one it names.
   *
   * That is what `context.replaces` is for, and a store that ignores it grows a session per renewal — a device
   * list full of ghosts of the same browser, and a revoked session that comes back.
   */
  saveSession: (userId, session, context) => {
    const row = find(candidate => candidate.id === userId);
    if (row) {
      const replaced = context?.replaces?.refreshToken;
      row.sessions = row.sessions.filter(item => !replaced || item.refreshToken !== replaced);
      row.sessions.push(session);
    }

    return Promise.resolve();
  },

  /** Signing out ends THAT session. By user id it ends every one of them, which is what a ban is. */
  clearSession: target => {
    for (const row of rows) {
      if (target.userId !== undefined && row.id === target.userId) {
        row.sessions = [];
        continue;
      }

      row.sessions = row.sessions.filter(
        session =>
          !(target.accessToken !== undefined && session.token === target.accessToken) &&
          !(target.refreshToken !== undefined && session.refreshToken === target.refreshToken)
      );
    }

    return Promise.resolve();
  },

  loadAccess: userId => Promise.resolve(ACCESS[userId] ?? { roles: [], permissions: [] }),

  /**
   * Note `refreshExpiresAt`: the server asks the account when its renewal credential dies, and a store that keeps
   * that inside a session object has to lift it out. Leave it off and every renewal is refused as expired.
   */
  findByRefreshToken: token => {
    const row = find(candidate => candidate.sessions.some(session => session.refreshToken === token));
    const session = row?.sessions.find(item => item.refreshToken === token);

    return Promise.resolve(row ? { ...row, refreshExpiresAt: session?.refreshExpiresAt } : undefined);
  }
};

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  Promise.resolve(verify(password, stored));
