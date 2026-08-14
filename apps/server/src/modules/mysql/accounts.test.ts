import { describe, expect, it } from 'vitest';

import { createAccountStore } from './accounts';
import { resolveTables } from './config';
import { hashPassword, verifyPassword } from './passwords';

import type { Queryable } from './query';

/** Records what was asked, answers what it was told to. Enough to assert on the SQL, which is the whole risk here. */
const fakeDb = (answers: unknown[][] = []) => {
  const calls: { sql: string; params: unknown[] }[] = [];
  let next = 0;

  const db = {
    query: (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });

      return Promise.resolve([answers[next++] ?? [], []]);
    }
  };

  return { db: db as unknown as Queryable, calls };
};

const tables = resolveTables();

describe('clearSession', () => {
  it('clears by whichever half the caller holds', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).clearSession({ refreshToken: 'r-1' });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('DELETE FROM `session` WHERE refresh_token = ?');
    expect(calls[0].params).toEqual(['r-1']);
  });

  /**
   * The one that matters. A `WHERE` assembled from an empty condition list is a `WHERE` that matches every row, so
   * an empty target would sign out every account in the deployment — from an argument someone left off.
   */
  it('issues no statement at all for an empty target', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).clearSession({});

    expect(calls).toHaveLength(0);
  });
});

describe('single-use tokens', () => {
  /**
   * The flows clear a reset token by setting it to `''`. Stored as an empty string it is a value that MATCHES, and
   * a reset link carrying no token would then resolve to whichever account was cleared first.
   */
  it('stores a cleared reset token as NULL', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).setResetToken?.(7, '');

    expect(calls[0].params).toEqual([null, 7]);
  });

  it('never looks an account up by a blank token', async () => {
    const { db, calls } = fakeDb();
    const store = createAccountStore(db, tables);

    expect(await store.findByResetToken?.('  ')).toBeUndefined();
    expect(await store.findByValidationToken?.('')).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe('findAccountByToken', () => {
  it('refuses a session held by a suspended account', async () => {
    const { db, calls } = fakeDb([[]]);
    const actor = await createAccountStore(db, tables).findAccountByToken('t-1');

    expect(actor).toBeUndefined();
    expect(calls[0].sql).toMatch(/a\.status = 'active'/);
  });

  it('reports the roles and permissions the account holds globally', async () => {
    const { db } = fakeDb([
      [
        {
          id: 3,
          username: 'ada',
          email: 'ada@example.test',
          password_hash: null,
          status: 'active',
          verified: 1,
          session_expires_at: 1800000000
        }
      ],
      [
        { role: 'editor', permission: 'spaceUpdate' },
        { role: 'editor', permission: 'spaceRead' }
      ]
    ]);

    expect(await createAccountStore(db, tables).findAccountByToken('t-1')).toEqual({
      id: 3,
      username: 'ada',
      email: 'ada@example.test',
      verified: true,
      roles: ['editor'],
      permissions: ['spaceUpdate', 'spaceRead'],
      token: 't-1',
      expiresAt: 1800000000
    });
  });
});

describe('findByRefreshToken', () => {
  /**
   * `refreshExpiresAt` has to come off the row. Left off, every renewal is refused as expired — which does not fail
   * at login but a day later, when the access token ages out and a session that looked fine simply ends.
   */
  it('carries refreshExpiresAt on the record', async () => {
    const { db } = fakeDb([
      [
        {
          id: 1,
          username: 'ada',
          email: 'ada@example.test',
          password_hash: 'scrypt$a$b',
          status: 'active',
          verified: 1,
          refresh_expires_at: 999
        }
      ]
    ]);

    expect(await createAccountStore(db, tables).findByRefreshToken?.('r-1')).toMatchObject({ refreshExpiresAt: 999 });
  });
});

describe('passwords', () => {
  it('round-trips, and refuses anything else', async () => {
    const stored = await hashPassword('correct horse');

    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
    expect(await verifyPassword('correct horse', 'bcrypt$a$b')).toBe(false);
    expect(await verifyPassword('correct horse', 'nonsense')).toBe(false);
  });

  it('salts, so two accounts with one password do not share a hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});

describe('saveSession', () => {
  const session = { token: 'a-2', expiresAt: 200, refreshToken: 'r-2', refreshExpiresAt: 900 };

  it('inserts a row for a fresh sign-in, recording the device', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).saveSession(1, session, { client: { userAgent: 'Firefox' } });

    expect(calls[0].sql).toContain('INSERT INTO `session`');
    expect(calls[0].params).toContain('Firefox');
  });

  /**
   * A renewal must REPLACE the session it names. Inserting instead grows a row per refresh: a device list that
   * fills with ghosts of one browser, and a revoked session that survives because the row meant to overwrite it
   * is still there.
   */
  it('updates the named row on a renewal instead of adding one', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).saveSession(1, session, { replaces: { refreshToken: 'r-1' } });

    expect(calls[0].sql).toContain('UPDATE `session`');
    expect(calls[0].sql).toContain('WHERE refresh_token = ? AND account_id = ?');
    expect(calls[0].params.slice(-2)).toEqual(['r-1', 1]);
  });

  it('scopes the replace to the account, so one account cannot rotate another\u2019s session', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).saveSession(7, session, { replaces: { accessToken: 'a-1' } });

    expect(calls[0].sql).toContain('WHERE token = ? AND account_id = ?');
    expect(calls[0].params.slice(-2)).toEqual(['a-1', 7]);
  });

  it('truncates an absurd user agent rather than failing the sign-in', async () => {
    const { db, calls } = fakeDb();
    await createAccountStore(db, tables).saveSession(1, session, { client: { userAgent: 'x'.repeat(4000) } });

    expect((calls[0].params[5] as string).length).toBe(255);
  });
});
