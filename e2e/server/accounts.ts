import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import type { IdentityAdapters } from '@plitzi/sdk-kernel/identity';
import type { AccountAdapters, AccountRecord } from '@plitzi/sdk-kernel/identity';
import type { SSRSession } from '@plitzi/sdk-kernel/types';

/** An account store, in memory, owned by the suite.
 *
 *  Real hashing rather than a string compare: a flow test that signs in against a fake credential check proves the
 *  form submitted, not that anybody was authenticated. Everything else here is the smallest thing the server needs
 *  — it looks accounts up through these functions and never learns where they came from. */

/** Every session the account holds, as a real store keeps one per device. One per row replaced the session of every
 *  spec signed in as the same person whenever another one signed in beside it: its next page read it as revoked. */
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

export const CREDENTIALS = {
  editor: { username: 'ada', password: 'password', email: 'ada@example.test' },
  viewer: { username: 'grace', password: 'password', email: 'grace@example.test' }
};

/** Two accounts with different access, so a spec can tell "signed in" from "signed in as somebody who may edit". */
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

const ACCESS: Record<number, { roles: string[]; permissions: string[] }> = {
  1: { roles: ['editor'], permissions: ['spaceUpdate'] },
  2: { roles: ['viewer'], permissions: [] }
};

const find = (predicate: (row: Row) => boolean): Row | undefined => rows.find(predicate);

export const accounts: IdentityAdapters & AccountAdapters = {
  /** Looked up BY THE TOKEN, not by user id. Keeping the sessions on the row is what makes signing out actually sign
   *  somebody out: a token no row holds is dead, however valid its signature. */
  findAccountByToken: token => {
    const row = find(candidate => candidate.sessions.some(session => session.token === token));
    const session = row?.sessions.find(held => held.token === token);

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

  saveSession: (userId, session) => {
    const row = find(candidate => candidate.id === userId);

    if (row) {
      row.sessions.push(session);
    }

    return Promise.resolve();
  },

  /** One session by either of its tokens; every one of the account by its id. */
  clearSession: target => {
    for (const row of rows) {
      row.sessions =
        target.userId !== undefined && row.id === target.userId
          ? []
          : row.sessions.filter(
              session =>
                (target.accessToken === undefined || session.token !== target.accessToken) &&
                (target.refreshToken === undefined || session.refreshToken !== target.refreshToken)
            );
    }

    return Promise.resolve();
  },

  loadAccess: userId => Promise.resolve(ACCESS[userId] ?? { roles: [], permissions: [] }),

  /** The token carries its own expiry, so the row is only the revocation switch. */
  findByRefreshToken: token =>
    Promise.resolve(find(candidate => candidate.sessions.some(session => session.refreshToken === token)))
};

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  Promise.resolve(verify(password, stored));
