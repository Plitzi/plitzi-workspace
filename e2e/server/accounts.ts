import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import type { AccountAdapters, AccountRecord, IdentityAdapters } from '@plitzi/sdk-server/auth';
import type { SSRSession } from '@plitzi/sdk-shared';

/** An account store, in memory, owned by the suite.
 *
 *  Real hashing rather than a string compare: a flow test that signs in against a fake credential check proves the
 *  form submitted, not that anybody was authenticated. Everything else here is the smallest thing the server needs
 *  — it looks accounts up through these functions and never learns where they came from. */

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

export const CREDENTIALS = {
  editor: { username: 'ada', password: 'password', email: 'ada@example.test' },
  viewer: { username: 'grace', password: 'password', email: 'grace@example.test' }
};

/** Two accounts with different access, so a spec can tell "signed in" from "signed in as somebody who may edit". */
const rows: Row[] = [
  { id: 1, username: 'ada', email: 'ada@example.test', active: true, verified: true, passwordHash: hash('password') },
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

/** Every session this process issued is forgotten. Between flow specs, so one test's sign-in cannot be what makes
 *  the next one pass. */
export const resetSessions = (): void => {
  rows.forEach(row => {
    row.session = undefined;
  });
};

export const accounts: IdentityAdapters & AccountAdapters = {
  /** Looked up BY THE TOKEN, not by user id. Keeping the current session on the row is what makes signing out
   *  actually sign somebody out: a token that no longer matches a row is dead, however valid its signature. */
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

  /** `refreshExpiresAt` is lifted out of the session on purpose: the server asks the ACCOUNT when its renewal
   *  credential dies. Leave it off and every renewal is refused as expired — the session works until the access
   *  token ages out and then quietly ends. */
  findByRefreshToken: token => {
    const row = find(candidate => candidate.session?.refreshToken === token);

    return Promise.resolve(row ? { ...row, refreshExpiresAt: row.session?.refreshExpiresAt } : undefined);
  }
};

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  Promise.resolve(verify(password, stored));
