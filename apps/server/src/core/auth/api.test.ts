import { describe, expect, it, vi } from 'vitest';

import { createAuthApi } from './api';
import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { createTokens } from './tokens';

import type { AccountAdapters, AccountRecord, AuthApiConfig } from './api';

// What the auth API is for: a deployment says where its accounts live and what it wants offered, and gets the flows
// without writing them. So what is asserted here is the deciding, not the plumbing — which endpoints exist at all,
// and what each one refuses.

const tokens = createTokens({ secret: 's', issuer: 'https://this.test', audience: ['a'] });

const identity = createIdentity({
  tokens,
  carriers: createCarriers(() => 'session'),
  presentedOrigin,
  adapters: { findAccountByToken: () => Promise.resolve(undefined), findSpaceToken: () => Promise.resolve(undefined) }
});

const ada: AccountRecord = {
  id: 1,
  username: 'ada',
  email: 'ada@example.com',
  active: true,
  verified: true,
  passwordHash: 'pw-hashed'
};

const build = (adapters: Partial<AccountAdapters> = {}, config: AuthApiConfig = {}) =>
  createAuthApi({
    tokens,
    identity,
    config: { verifyPassword: (plain, hash) => Promise.resolve(hash === `${plain}-hashed`), ...config },
    adapters: {
      saveSession: () => Promise.resolve(),
      clearSession: () => Promise.resolve(),
      loadAccess: () => Promise.resolve({ roles: ['user'], permissions: ['spaceUpdate'] }),
      ...adapters
    }
  });

describe('what a deployment ends up offering', () => {
  // The rule that keeps a self-hoster out of trouble: a route whose adapter is missing cannot work, so it is not
  // offered rather than failing at runtime when somebody finds it.
  it('offers nothing it has no adapter for', () => {
    const api = build();

    expect(api.capabilities).toMatchObject({ passwordLogin: false, signup: false, refresh: false, exchange: false });
  });

  it('offers what the adapters make possible', () => {
    const api = build(
      { findByUsername: () => Promise.resolve(ada), findByRefreshToken: () => Promise.resolve(ada) },
      { hashPassword: p => Promise.resolve(`${p}-hashed`) }
    );

    expect(api.capabilities).toMatchObject({ passwordLogin: true, refresh: true });
  });

  // A space signing people in through an external provider wants no signup and no password reset. Declining one is
  // a single act — leave the adapter out — rather than an adapter and a flag that can disagree with each other.
  it('offers only what was actually supplied', () => {
    const api = build(
      { createAccount: () => Promise.resolve(ada) },
      { hashPassword: p => Promise.resolve(`${p}-hashed`) }
    );

    expect(api.capabilities).toMatchObject({ signup: true, passwordLogin: false, passwordReset: false });
  });

  // The half-wired case: an adapter without the piece it needs. Offering the endpoint anyway would fail inside it.
  it('does not offer a flow whose other half is missing', () => {
    const api = build({ findByUsername: () => Promise.resolve(ada) }, { verifyPassword: undefined });

    expect(api.capabilities).toMatchObject({ passwordLogin: false });
  });

  it('publishes the result, so a client renders a form that matches', () => {
    const api = build({ findByUsername: () => Promise.resolve(ada) });
    const described = api.describe();

    expect(described.ok && described.body).toEqual({ features: api.capabilities });
  });

  it('answers 404 for a flow it does not offer, rather than failing inside it', async () => {
    const outcome = await build().login({ username: 'ada', password: 'pw' });

    expect(outcome).toMatchObject({ ok: false, status: 404 });
  });
});

describe('signing in', () => {
  it('mints a session and answers with the identity it belongs to', async () => {
    const saveSession = vi.fn(() => Promise.resolve());
    const api = build({ findByUsername: () => Promise.resolve(ada), saveSession });

    const outcome = await api.login({ username: 'ada', password: 'pw' });

    expect(outcome.ok).toBe(true);
    const [userId, saved, context] = saveSession.mock.calls[0] as unknown as [
      number,
      { token: string },
      { replaces?: unknown }
    ];

    expect(userId).toBe(1);
    expect(saved.token).toEqual(expect.any(String));
    // A sign-in CREATES a session rather than replacing one, which is the distinction a session table depends on.
    expect(context.replaces).toBeUndefined();
    // A grant is an identity: the client knows who it is without a follow-up call.
    expect(outcome.ok && outcome.body).toMatchObject({
      details: { id: 1, username: 'ada', permissions: ['spaceUpdate'] }
    });
    expect(outcome.ok && outcome.session?.refreshToken).toEqual(expect.any(String));
  });

  it('refuses a wrong password without saying which half was wrong', async () => {
    const api = build({ findByUsername: () => Promise.resolve(ada) });

    const wrongPassword = await api.login({ username: 'ada', password: 'nope' });
    const noSuchUser = await build({ findByUsername: () => Promise.resolve(undefined) }).login({
      username: 'ghost',
      password: 'pw'
    });

    expect(wrongPassword).toMatchObject({ ok: false, status: 401, body: { error: 'Invalid credentials' } });
    expect(noSuchUser).toMatchObject({ ok: false, status: 401, body: { error: 'Invalid credentials' } });
  });

  // An account created through an identity provider has no password. Comparing an empty hash is how such an account
  // gets taken over by anyone who guesses that it exists.
  it('never compares an empty hash', async () => {
    const verifyPassword = vi.fn(() => Promise.resolve(true));
    const api = build(
      { findByUsername: () => Promise.resolve({ ...ada, passwordHash: undefined }) },
      { verifyPassword }
    );

    expect(await api.login({ username: 'ada', password: '' })).toMatchObject({ ok: false });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('refuses an inactive account before looking at its password', async () => {
    const api = build({ findByUsername: () => Promise.resolve({ ...ada, active: false }) });

    expect(await api.login({ username: 'ada', password: 'pw' })).toMatchObject({
      ok: false,
      body: { error: 'Account is not active' }
    });
  });
});

describe('renewing and ending a session', () => {
  const live = { ...ada, refreshExpiresAt: Math.floor(Date.now() / 1000) + 3600 };

  it('renews on a live refresh credential, and says so as a renewable failure when it has lapsed', async () => {
    const renewed = await build({ findByRefreshToken: () => Promise.resolve(live) }).refresh('r');
    const lapsed = await build({
      findByRefreshToken: () => Promise.resolve({ ...ada, refreshExpiresAt: 1 })
    }).refresh('r');

    expect(renewed.ok).toBe(true);
    expect(lapsed).toMatchObject({ ok: false, status: 401, body: { reason: 'expired' } });
  });

  // Reachable with an expired access token on purpose: otherwise a live refresh token could never be revoked.
  it('signs out with whatever credential the caller still holds', async () => {
    const clearSession = vi.fn(() => Promise.resolve());
    const outcome = await build({ clearSession }).logout({ refreshToken: 'r' });

    expect(clearSession).toHaveBeenCalledWith({ refreshToken: 'r' });
    expect(outcome.ok && outcome.endSession).toBe(true);
  });

  it('refuses to revoke everything for a caller with no session', async () => {
    expect(await build().revokeSessions(undefined)).toMatchObject({ ok: false, status: 401 });
  });
});

describe('recovering a password', () => {
  const resetAdapters = {
    findByEmail: (email: string) => Promise.resolve(email === ada.email ? ada : undefined),
    setResetToken: vi.fn(() => Promise.resolve()),
    findByResetToken: () => Promise.resolve(ada),
    setPassword: vi.fn(() => Promise.resolve()),
    sendMail: vi.fn(() => Promise.resolve())
  };
  const resetConfig = { hashPassword: (p: string) => Promise.resolve(`${p}-hashed`), generateToken: () => 'tok' };

  // Whether an address has an account here is not something a stranger may establish by asking.
  it('answers a stranger exactly as it answers a member', async () => {
    const api = build(resetAdapters, resetConfig);

    const known = await api.forgotPassword(ada.email);
    const unknown = await api.forgotPassword('nobody@example.com');

    expect(known.ok && known.body).toEqual(unknown.ok && unknown.body);
  });

  it('ends every session when the password changes', async () => {
    const clearSession = vi.fn(() => Promise.resolve());
    const api = build({ ...resetAdapters, clearSession }, resetConfig);

    const outcome = await api.resetPassword('tok', 'new-password');

    // Whoever forced the reset, or stole the old password, must not keep a working session.
    expect(clearSession).toHaveBeenCalledWith({ userId: 1 });
    expect(outcome.ok && outcome.endSession).toBe(true);
  });
});

// JSON carries an all-digits password as a number. Refusing it as "credentials are required" is a lie about what
// arrived, and the client that sent it has no way to tell what it did wrong.
describe('credentials that do not arrive as strings', () => {
  it('accepts an all-digits password', async () => {
    const api = build({ findByUsername: () => Promise.resolve({ ...ada, passwordHash: '123456-hashed' }) });

    const outcome = await api.login({ username: 'ada', password: 123456 });

    expect(outcome.ok).toBe(true);
  });

  it('still refuses a body that carries no credential at all', async () => {
    const api = build({ findByUsername: () => Promise.resolve(ada) });

    expect(await api.login({ username: 'ada', password: { nested: true } })).toMatchObject({
      ok: false,
      status: 400
    });
  });
});
