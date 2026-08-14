import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthApi } from './api';
import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { createTokens } from './tokens';
import { totpCode } from './totp';

import type {
  AccountAdapters,
  AccountRecord,
  AuthApiConfig,
  AuthOutcome,
  MfaRecord,
  SecurityEvent,
  SessionSummary
} from './api';
import type { Actor } from './identity';

/**
 * The account's life after it exists: what it may change about itself, what an administrator may change about it,
 * and what each of those does to the sessions it is holding. Everything here is a rule the server owns, so it is
 * asserted against fake adapters rather than a database.
 */

const ada: AccountRecord = {
  id: 1,
  username: 'ada',
  email: 'ada@example.test',
  active: true,
  verified: true,
  passwordHash: 'hash:pw'
};

const actorFor = (account: AccountRecord, permissions: string[] = []): Actor => ({
  id: account.id,
  username: account.username,
  email: account.email,
  verified: account.verified,
  roles: [],
  permissions,
  token: `token-${account.id}`,
  expiresAt: Math.floor(Date.now() / 1000) + 3600
});

const build = (adapters: Partial<AccountAdapters> = {}, config: AuthApiConfig = {}) => {
  const tokens = createTokens({ secret: 'test-secret', issuer: 'https://test' });
  const full: AccountAdapters = {
    saveSession: () => Promise.resolve(),
    clearSession: () => Promise.resolve(),
    loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
    ...adapters
  };

  const identity = createIdentity({
    tokens,
    carriers: createCarriers(() => 'sess'),
    presentedOrigin,
    adapters: { findAccountByToken: () => Promise.resolve(undefined) }
  });

  return createAuthApi({
    tokens,
    identity,
    adapters: full,
    config: {
      verifyPassword: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
      hashPassword: plain => Promise.resolve(`hash:${plain}`),
      ...config
    }
  });
};

const body = (outcome: AuthOutcome): Record<string, unknown> => outcome.body as Record<string, unknown>;

describe('capabilities follow the adapters', () => {
  it('offers nothing extra to a store that implements nothing extra', () => {
    expect(build().capabilities).toMatchObject({
      profile: false,
      passwordChange: false,
      accountDeletion: false,
      sessionList: false,
      administration: false
    });
  });

  it('offers each flow exactly when its adapters are there', () => {
    const api = build({
      findById: () => Promise.resolve(ada),
      updateAccount: () => Promise.resolve(ada),
      setPassword: () => Promise.resolve(),
      deleteAccount: () => Promise.resolve(),
      listSessions: () => Promise.resolve([]),
      listAccounts: () => Promise.resolve({ accounts: [], total: 0 })
    });

    expect(api.capabilities).toMatchObject({
      profile: true,
      passwordChange: true,
      accountDeletion: true,
      sessionList: true,
      administration: true
    });
  });

  it('answers 404 rather than failing when a flow is not offered', async () => {
    const api = build();

    expect(await api.updateProfile(actorFor(ada), { username: 'x' })).toMatchObject({ ok: false, status: 404 });
    expect(await api.changePassword(actorFor(ada), 'a', 'n3wPassw0rd')).toMatchObject({ ok: false, status: 404 });
    expect(await api.deleteSelf(actorFor(ada))).toMatchObject({ ok: false, status: 404 });
    expect(await api.listSessions(actorFor(ada))).toMatchObject({ ok: false, status: 404 });
  });
});

describe('updating a profile', () => {
  const updateAccount = (_userId: number, changes: { username?: string; email?: string }) =>
    Promise.resolve({ ...ada, ...changes });

  it('changes only what was named', async () => {
    const update = vi.fn(updateAccount);
    const api = build({ updateAccount: update, findByEmail: () => Promise.resolve(undefined) });

    await api.updateProfile(actorFor(ada), { email: 'new@example.test' });

    expect(update).toHaveBeenCalledWith(1, { email: 'new@example.test' });
  });

  it('refuses a username somebody else holds', async () => {
    const api = build({
      updateAccount,
      findByUsername: () => Promise.resolve({ ...ada, id: 2, username: 'grace' })
    });

    expect(await api.updateProfile(actorFor(ada), { username: 'grace' })).toMatchObject({ ok: false, status: 409 });
  });

  /** Their own name is not a collision — re-submitting an unchanged form must not be an error. */
  it('accepts the caller keeping the name they already have', async () => {
    const api = build({ updateAccount, findByUsername: () => Promise.resolve(ada) });

    expect(await api.updateProfile(actorFor(ada), { username: 'ada' })).toMatchObject({ ok: true });
  });

  it('refuses an empty change rather than writing nothing and claiming success', async () => {
    const api = build({ updateAccount });

    expect(await api.updateProfile(actorFor(ada), {})).toMatchObject({ ok: false, status: 400 });
  });

  it('never answers with the password hash', async () => {
    const api = build({ updateAccount, findByEmail: () => Promise.resolve(undefined) });
    const outcome = await api.updateProfile(actorFor(ada), { email: 'new@example.test' });

    expect(JSON.stringify(body(outcome))).not.toContain('hash:');
  });
});

describe('changing a password', () => {
  const adapters = {
    findById: () => Promise.resolve(ada),
    setPassword: vi.fn(() => Promise.resolve()),
    revokeOtherSessions: vi.fn(() => Promise.resolve(2))
  };

  it('refuses without the current one', async () => {
    const api = build(adapters);

    expect(await api.changePassword(actorFor(ada), 'wrong', 'n3wPassw0rd')).toMatchObject({ ok: false, status: 401 });
    expect(adapters.setPassword).not.toHaveBeenCalled();
  });

  /**
   * The half that makes it mean something. Changing a password is what somebody does when they think a credential
   * escaped; leaving the other sessions signed in does not do what they asked for.
   */
  it('signs out the other devices, and not the one asking', async () => {
    const setPassword = vi.fn(() => Promise.resolve());
    const revokeOtherSessions = vi.fn(() => Promise.resolve(2));
    const clearSession = vi.fn(() => Promise.resolve());
    const api = build({ findById: () => Promise.resolve(ada), setPassword, revokeOtherSessions, clearSession });
    const actor = actorFor(ada);

    expect(await api.changePassword(actor, 'pw', 'n3wPassw0rd')).toMatchObject({ ok: true });
    expect(setPassword).toHaveBeenCalledWith(1, 'hash:n3wPassw0rd');
    expect(revokeOtherSessions).toHaveBeenCalledWith(1, actor.token);
    expect(clearSession).not.toHaveBeenCalled();
  });
});

describe('closing an account', () => {
  it('asks for the password when the account has one', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const api = build({ findById: () => Promise.resolve(ada), deleteAccount });

    expect(await api.deleteSelf(actorFor(ada), 'wrong')).toMatchObject({ ok: false, status: 401 });
    expect(await api.deleteSelf(actorFor(ada))).toMatchObject({ ok: false, status: 401 });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes and ends the session when it is right', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const api = build({ findById: () => Promise.resolve(ada), deleteAccount });
    const outcome = await api.deleteSelf(actorFor(ada), 'pw');

    expect(outcome).toMatchObject({ ok: true, endSession: true });
    expect(deleteAccount).toHaveBeenCalledWith(1);
  });

  /** An account created through an identity provider has no password to be asked for; the session is the proof. */
  it('accepts the session alone for an account with no password', async () => {
    const passwordless = { ...ada, passwordHash: undefined };
    const api = build({ findById: () => Promise.resolve(passwordless), deleteAccount: () => Promise.resolve() });

    expect(await api.deleteSelf(actorFor(passwordless))).toMatchObject({ ok: true });
  });
});

describe('sessions', () => {
  const sessions: SessionSummary[] = [
    { id: 1, userAgent: 'laptop', createdAt: 1, expiresAt: 2, current: true },
    { id: 2, userAgent: 'phone', createdAt: 1, expiresAt: 2, current: false }
  ];

  it('lists them, marking the one asking', async () => {
    const listSessions = vi.fn(() => Promise.resolve(sessions));
    const api = build({ listSessions });
    const actor = actorFor(ada);

    expect(body(await api.listSessions(actor))).toEqual({ sessions });
    expect(listSessions).toHaveBeenCalledWith(1, actor.token);
  });

  /** Scoped to the caller's own account: a session id from somebody else must not resolve. */
  it('revokes one, scoped to the caller', async () => {
    const revokeSession = vi.fn(() => Promise.resolve(true));
    const api = build({ revokeSession });

    expect(await api.revokeSession(actorFor(ada), 2)).toMatchObject({ ok: true });
    expect(revokeSession).toHaveBeenCalledWith(1, 2);
  });

  it('404s for a session that is not the caller’s', async () => {
    const api = build({ revokeSession: () => Promise.resolve(false) });

    expect(await api.revokeSession(actorFor(ada), 99)).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses an id that is not one', async () => {
    const revokeSession = vi.fn(() => Promise.resolve(true));
    const api = build({ revokeSession });

    expect(await api.revokeSession(actorFor(ada), Number.NaN)).toMatchObject({ ok: false, status: 400 });
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('ends the others and says how many', async () => {
    const api = build({ revokeOtherSessions: () => Promise.resolve(3) });

    expect(body(await api.revokeOtherSessions(actorFor(ada)))).toMatchObject({ revoked: 3 });
  });
});

describe('administration', () => {
  const adminActor = actorFor({ ...ada, id: 9, username: 'root' }, ['userManage']);

  const adminApi = (extra: Partial<AccountAdapters> = {}) =>
    build({
      findById: (id: number) => Promise.resolve(id === 1 ? ada : undefined),
      listAccounts: () => Promise.resolve({ accounts: [ada], total: 1 }),
      setStatus: () => Promise.resolve(),
      setRoles: () => Promise.resolve(),
      deleteAccount: () => Promise.resolve(),
      ...extra
    });

  it('refuses an actor without the permission, and a stranger differently', async () => {
    const api = adminApi();

    expect(await api.admin.list(actorFor(ada), {})).toMatchObject({ ok: false, status: 403 });
    expect(await api.admin.list(undefined, {})).toMatchObject({ ok: false, status: 401 });
  });

  it('honours a deployment’s own permission name', async () => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findById: () => Promise.resolve(ada),
        listAccounts: () => Promise.resolve({ accounts: [], total: 0 })
      },
      config: { adminPermission: 'staff' }
    });

    expect(await api.admin.list(actorFor(ada, ['userManage']), {})).toMatchObject({ status: 403 });
    expect(await api.admin.list(actorFor(ada, ['staff']), {})).toMatchObject({ ok: true });
  });

  it('lists accounts without their hashes', async () => {
    expect(JSON.stringify(body(await adminApi().admin.list(adminActor, {})))).not.toContain('hash:');
  });

  it('404s for an account that is not there', async () => {
    expect(await adminApi().admin.get(adminActor, 404)).toMatchObject({ ok: false, status: 404 });
  });

  /**
   * The rule that makes a ban a ban. Without it the person stays signed in until their token happens to lapse,
   * and the row saying `blocked` is a note in a database.
   */
  it('ends every session when an account stops being active', async () => {
    const clearSession = vi.fn(() => Promise.resolve());
    const api = adminApi({ clearSession });

    expect(await api.admin.setStatus(adminActor, 1, 'blocked')).toMatchObject({ ok: true });
    expect(clearSession).toHaveBeenCalledWith({ userId: 1 });
  });

  it('does not end sessions when an account is restored', async () => {
    const clearSession = vi.fn(() => Promise.resolve());
    const api = adminApi({ clearSession });

    await api.admin.setStatus(adminActor, 1, 'active');

    expect(clearSession).not.toHaveBeenCalled();
  });

  it('refuses a status it does not have', async () => {
    const api = adminApi();

    expect(await api.admin.setStatus(adminActor, 1, 'sleepy' as 'active')).toMatchObject({ ok: false, status: 400 });
  });

  /** How a deployment loses its last administrator. Closing your own account is the self-service flow. */
  it('refuses an administrator acting on their own account', async () => {
    const api = adminApi({ findById: () => Promise.resolve(ada) });

    expect(await api.admin.setStatus(adminActor, 9, 'blocked')).toMatchObject({ ok: false, status: 400 });
    expect(await api.admin.remove(adminActor, 9)).toMatchObject({ ok: false, status: 400 });
  });

  it('sets roles to exactly the list given', async () => {
    const setRoles = vi.fn(() => Promise.resolve());
    const api = adminApi({ setRoles });

    expect(await api.admin.setRoles(adminActor, 1, ['editor'])).toMatchObject({ ok: true });
    expect(setRoles).toHaveBeenCalledWith(1, ['editor']);
  });

  /**
   * `roles: "editor"` is the obvious client mistake, and it used to be coerced to an empty list — every role
   * removed, reported as success. The wrong shape has to be a refusal, not a silent wipe.
   */
  it('refuses roles that are not a list of names', async () => {
    const setRoles = vi.fn(() => Promise.resolve());
    const api = adminApi({ setRoles });

    expect(await api.admin.setRoles(adminActor, 1, [3])).toMatchObject({ status: 400 });
    expect(await api.admin.setRoles(adminActor, 1, 'editor')).toMatchObject({ status: 400 });
    expect(await api.admin.setRoles(adminActor, 1, undefined)).toMatchObject({ status: 400 });
    expect(setRoles).not.toHaveBeenCalled();
  });

  it('deletes somebody else', async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const api = adminApi({ deleteAccount });

    expect(await api.admin.remove(adminActor, 1)).toMatchObject({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith(1);
  });
});

describe('what a password has to be', () => {
  const store = {
    createAccount: vi.fn((account: { username: string; email: string; passwordHash: string }) =>
      Promise.resolve({ ...ada, ...account })
    ),
    findByResetToken: () => Promise.resolve(ada),
    setPassword: vi.fn(() => Promise.resolve()),
    setResetToken: () => Promise.resolve(),
    findByEmail: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(ada)
  };

  /** NIST SP 800-63B's floor. Deliberately no composition rules: those measurably produce `Password1!`. */
  it('is at least eight characters, everywhere one is set', async () => {
    const api = build(store);

    expect(await api.signup({ username: 'new', email: 'n@e.test', password: 'short' })).toMatchObject({ status: 400 });
    expect(await api.resetPassword('tok', 'short')).toMatchObject({ status: 400 });
    expect(await api.changePassword(actorFor(ada), 'pw', 'short')).toMatchObject({ status: 400 });
    expect(store.createAccount).not.toHaveBeenCalled();
    expect(store.setPassword).not.toHaveBeenCalled();
  });

  it('says how long it needed to be', async () => {
    const outcome = await build(store).signup({ username: 'new', email: 'n@e.test', password: 'short' });

    expect(body(outcome).error).toContain('8 characters');
  });

  it('takes the deployment’s own minimum', async () => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        createAccount: account => Promise.resolve({ ...ada, ...account })
      },
      config: { hashPassword: plain => Promise.resolve(`hash:${plain}`), password: { minLength: 16 } }
    });

    expect(await api.signup({ username: 'n', email: 'n@e.test', password: 'elevenchars' })).toMatchObject({
      status: 400
    });
  });

  /** The hook is where a breach-list lookup or a strength estimator goes; the reason it gives reaches the caller. */
  it('reports what a deployment’s own rule refused, and what it was given', async () => {
    const validate = vi.fn(() => Promise.resolve('That password is in a breach list'));
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        createAccount: account => Promise.resolve({ ...ada, ...account })
      },
      config: { hashPassword: plain => Promise.resolve(`hash:${plain}`), password: { validate } }
    });

    const outcome = await api.signup({ username: 'ada2', email: 'a2@e.test', password: 'correcthorsebattery' });

    expect(body(outcome).error).toBe('That password is in a breach list');
    expect(validate).toHaveBeenCalledWith('correcthorsebattery', { username: 'ada2', email: 'a2@e.test' });
  });
});

describe('throttling', () => {
  const carrier = { headers: {}, hostname: 'test' };

  const limited = (adapters: Partial<AccountAdapters>, rateLimit: AuthApiConfig['rateLimit']) => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });

    return createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        ...adapters
      },
      config: {
        verifyPassword: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
        hashPassword: plain => Promise.resolve(`hash:${plain}`),
        generateToken: () => 'tok',
        rateLimit
      }
    });
  };

  it('is absent by default, because where the counter lives is the deployment’s call', async () => {
    const findByUsername = vi.fn(() => Promise.resolve(ada));
    const api = build({ findByUsername });

    await api.login({ username: 'ada', password: 'wrong' });
    await api.login({ username: 'ada', password: 'wrong' });

    expect(findByUsername).toHaveBeenCalledTimes(2);
  });

  /**
   * Before the password is checked, which is the whole point: a throttled attempt must cost no hash, or the limit
   * is only a slightly slower way to be brute-forced.
   */
  it('refuses a sign-in before it looks the account up at all', async () => {
    const findByUsername = vi.fn(() => Promise.resolve(ada));
    const verifyPassword = vi.fn(() => Promise.resolve(true));
    const api = limited({ findByUsername }, () => Promise.resolve(false));

    expect(await api.login({ username: 'ada', password: 'pw' }, carrier)).toMatchObject({ status: 429 });
    expect(findByUsername).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('passes the attempt along so a deployment can key it however it likes', async () => {
    const rateLimit = vi.fn(() => Promise.resolve(true));
    const api = limited({ findByUsername: () => Promise.resolve(undefined) }, rateLimit);

    await api.login({ username: 'ada', password: 'pw' }, carrier);

    expect(rateLimit).toHaveBeenCalledWith({ action: 'login', key: 'ada', carrier });
  });

  it('tells the caller when to come back', async () => {
    const api = limited({ findByUsername: () => Promise.resolve(ada) }, () =>
      Promise.resolve({ allowed: false, retryAfter: 42 })
    );
    const outcome = await api.login({ username: 'ada', password: 'pw' });

    expect(body(outcome)).toMatchObject({ retryAfter: 42 });
  });

  it('throttles every act worth throttling, not only sign-in', async () => {
    const seen: string[] = [];
    const api = limited(
      {
        findByUsername: () => Promise.resolve(ada),
        createAccount: account => Promise.resolve({ ...ada, ...account }),
        findByEmail: () => Promise.resolve(ada),
        findByResetToken: () => Promise.resolve(ada),
        setResetToken: () => Promise.resolve(),
        setPassword: () => Promise.resolve(),
        findById: () => Promise.resolve(ada)
      },
      attempt => {
        seen.push(attempt.succeeded ? `${attempt.action}:ok` : attempt.action);

        return Promise.resolve(true);
      }
    );

    await api.login({ username: 'ada', password: 'pw' });
    await api.signup({ username: 'n', email: 'n@e.test', password: 'longenoughpw' });
    await api.forgotPassword('ada@example.test');
    await api.resetPassword('tok', 'longenoughpw');
    await api.changePassword(actorFor(ada), 'pw', 'longenoughpw');

    expect(seen.filter(action => !action.endsWith(':ok'))).toEqual([
      'login',
      'signup',
      'forgotPassword',
      'resetPassword',
      'changePassword'
    ]);
  });

  /**
   * The check runs before the password is examined — that is what makes a throttled attempt cost no hash — so the
   * counter cannot tell ten failures from ten sign-ins unless success is reported back. Without it an app that
   * signs the same account in repeatedly locks it out by succeeding.
   */
  it('reports a success, so the counter is not spent by working', async () => {
    const seen: { action: string; succeeded?: boolean }[] = [];
    const api = limited({ findByUsername: () => Promise.resolve(ada) }, attempt => {
      seen.push({ action: attempt.action, succeeded: attempt.succeeded });

      return Promise.resolve(true);
    });

    await api.login({ username: 'ada', password: 'pw' });

    expect(seen).toEqual([
      { action: 'login', succeeded: undefined },
      { action: 'login', succeeded: true }
    ]);
  });

  it('says nothing back when the attempt failed', async () => {
    const seen: (boolean | undefined)[] = [];
    const api = limited({ findByUsername: () => Promise.resolve(ada) }, attempt => {
      seen.push(attempt.succeeded);

      return Promise.resolve(true);
    });

    await api.login({ username: 'ada', password: 'wrong' });

    expect(seen).toEqual([undefined]);
  });
});

describe('changing the email that was verified', () => {
  const withVerification = (overrides: Partial<AccountAdapters> = {}) => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });

    return createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        updateAccount: (_id, changes) => Promise.resolve({ ...ada, ...changes }),
        findByEmail: () => Promise.resolve(undefined),
        findByValidationToken: () => Promise.resolve(ada),
        setValidationToken: () => Promise.resolve(),
        setVerified: () => Promise.resolve(),
        ...overrides
      },
      config: { generateToken: () => 'fresh-token' }
    });
  };

  it('sends a confirmation to the new address', async () => {
    const setValidationToken = vi.fn(() => Promise.resolve());
    const sendMail = vi.fn(() => Promise.resolve());
    const api = withVerification({ setValidationToken, sendMail });

    await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });

    expect(setValidationToken).toHaveBeenCalledWith(1, expect.stringMatching(/^fresh-token~\d+$/));
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'elsewhere@example.test', template: 'validation' })
    );
  });

  /**
   * The regression this guards. `verified` gates ACCESS here — `createAuthorizer` will not present an unverified
   * account as an actor at all — so clearing it on an email change locks somebody out of the account they are
   * sitting in for correcting a typo.
   */
  it('does not lock the account out by un-verifying it', async () => {
    const setVerified = vi.fn(() => Promise.resolve());
    const api = withVerification({ setVerified });

    const outcome = await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });

    expect(setVerified).not.toHaveBeenCalled();
    expect(body(outcome)).toMatchObject({ details: { verified: true } });
  });

  it('sends nothing when the address did not change', async () => {
    const sendMail = vi.fn(() => Promise.resolve());
    const api = withVerification({ sendMail });

    await api.updateProfile(actorFor(ada), { email: ada.email, username: 'ada-renamed' });

    expect(sendMail).not.toHaveBeenCalled();
  });

  /** A deployment that does not verify emails has none of those adapters, and nothing here should appear. */
  it('does nothing extra for a deployment that does not verify emails', async () => {
    const api = build({ updateAccount: (_id, changes) => Promise.resolve({ ...ada, ...changes }) });
    const outcome = await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });

    expect(outcome).toMatchObject({ ok: true });
    expect(body(outcome)).not.toHaveProperty('message');
  });
});

/**
 * The shape an email change should have had all along: the new address is parked until somebody proves they read
 * it, and the account signs in with the old one until then.
 */
describe('changing the email by confirming it', () => {
  const parked = { account: ada, email: 'elsewhere@example.test' };

  const withPending = (overrides: Partial<AccountAdapters> = {}) => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });

    return createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        updateAccount: (_id, changes) => Promise.resolve({ ...ada, ...changes }),
        findByEmail: () => Promise.resolve(undefined),
        setPendingEmail: () => Promise.resolve(),
        findByPendingEmail: token => Promise.resolve(token === 'fresh-token' ? parked : undefined),
        clearPendingEmail: () => Promise.resolve(),
        setVerified: () => Promise.resolve(),
        sendMail: () => Promise.resolve(),
        ...overrides
      },
      config: { generateToken: () => 'fresh-token' }
    });
  };

  it('is offered exactly when there is somewhere to park an address', () => {
    expect(withPending().capabilities.emailChange).toBe(true);
    expect(build().capabilities.emailChange).toBe(false);
  });

  /** The whole point: until it is confirmed, the account's address — the thing it signs in with — is untouched. */
  it('does not change the address yet', async () => {
    const updateAccount = vi.fn((_id: number, changes: { username?: string; email?: string }) =>
      Promise.resolve({ ...ada, ...changes })
    );
    const setPendingEmail = vi.fn(() => Promise.resolve());
    const api = withPending({ updateAccount, setPendingEmail });

    const outcome = await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });

    expect(updateAccount).toHaveBeenCalledWith(1, {});
    expect(setPendingEmail).toHaveBeenCalledWith(
      1,
      'elsewhere@example.test',
      expect.stringMatching(/^fresh-token~\d+$/)
    );
    expect(body(outcome)).toMatchObject({ pendingEmail: 'elsewhere@example.test', details: { email: ada.email } });
  });

  it('still applies a username changed in the same request', async () => {
    const updateAccount = vi.fn((_id: number, changes: { username?: string; email?: string }) =>
      Promise.resolve({ ...ada, ...changes })
    );
    const api = withPending({ updateAccount });

    await api.updateProfile(actorFor(ada), { username: 'ada-renamed', email: 'elsewhere@example.test' });

    expect(updateAccount).toHaveBeenCalledWith(1, { username: 'ada-renamed' });
  });

  it('sends the confirmation to the new address, never the old one', async () => {
    const sendMail = vi.fn(() => Promise.resolve());
    await withPending({ sendMail }).updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'elsewhere@example.test',
        template: 'email-change',
        data: {
          username: 'ada',
          email: 'elsewhere@example.test',
          confirmationToken: expect.stringMatching(/^fresh-token~\d+$/) as unknown as string
        }
      })
    );
  });

  it('applies it once the token comes back, and takes the address as proven', async () => {
    const updateAccount = vi.fn((_id: number, changes: { username?: string; email?: string }) =>
      Promise.resolve({ ...ada, ...changes })
    );
    const clearPendingEmail = vi.fn(() => Promise.resolve());
    const setVerified = vi.fn(() => Promise.resolve());
    const api = withPending({ updateAccount, clearPendingEmail, setVerified });

    const outcome = await api.confirmEmailChange('fresh-token');

    expect(updateAccount).toHaveBeenCalledWith(1, { email: 'elsewhere@example.test' });
    expect(clearPendingEmail).toHaveBeenCalledWith(1);
    expect(setVerified).toHaveBeenCalledWith(1, true);
    expect(body(outcome)).toMatchObject({ details: { email: 'elsewhere@example.test', verified: true } });
  });

  it('refuses a token nobody is waiting on', async () => {
    expect(await withPending().confirmEmailChange('nonsense')).toMatchObject({ ok: false, status: 400 });
    expect(await withPending().confirmEmailChange('')).toMatchObject({ ok: false, status: 400 });
  });

  /** Somebody else may have signed up with it in the meantime, and the address is a sign-in identifier. */
  it('refuses to take an address that was claimed while it waited', async () => {
    const clearPendingEmail = vi.fn(() => Promise.resolve());
    const updateAccount = vi.fn(() => Promise.resolve(ada));
    const api = withPending({
      clearPendingEmail,
      updateAccount,
      findByEmail: () => Promise.resolve({ ...ada, id: 99 })
    });

    expect(await api.confirmEmailChange('fresh-token')).toMatchObject({ ok: false, status: 409 });
    expect(updateAccount).not.toHaveBeenCalled();
    // The dead pending change goes with it, or every later attempt hits the same 409 forever.
    expect(clearPendingEmail).toHaveBeenCalledWith(1);
  });

  it('is spent: the same token does not work twice', async () => {
    let pending: typeof parked | undefined = parked;
    const api = withPending({
      findByPendingEmail: () => Promise.resolve(pending),
      clearPendingEmail: () => {
        pending = undefined;

        return Promise.resolve();
      }
    });

    expect(await api.confirmEmailChange('fresh-token')).toMatchObject({ ok: true });
    expect(await api.confirmEmailChange('fresh-token')).toMatchObject({ ok: false, status: 400 });
  });

  it('answers 404 where no address can be parked', async () => {
    expect(await build().confirmEmailChange('fresh-token')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('when the mail provider is down', () => {
  /**
   * Every one of these sends AFTER something has been committed. Letting the provider decide whether the request
   * succeeded reports a change that DID happen as a 500, and the caller retries against the new state.
   */
  it('does not fail a change that already happened', async () => {
    const onMailError = vi.fn();
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        updateAccount: (_id, changes) => Promise.resolve({ ...ada, ...changes }),
        createAccount: account => Promise.resolve({ ...ada, ...account }),
        findByValidationToken: () => Promise.resolve(ada),
        setValidationToken: () => Promise.resolve(),
        setVerified: () => Promise.resolve(),
        sendMail: () => Promise.reject(new Error('no API key'))
      },
      config: { hashPassword: plain => Promise.resolve(`hash:${plain}`), generateToken: () => 'tok', onMailError }
    });

    expect(await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' })).toMatchObject({ ok: true });
    expect(await api.signup({ username: 'n', email: 'n@e.test', password: 'longenoughpw' })).toMatchObject({
      ok: true
    });
    expect(onMailError).toHaveBeenCalledTimes(2);
  });
});

describe('a second factor', () => {
  const withMfa = (initial?: MfaRecord, extra: Partial<AccountAdapters> = {}) => {
    let stored = initial;
    const tokens = createTokens({ secret: 's', issuer: 'https://acme.test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });

    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findById: () => Promise.resolve(ada),
        findByUsername: () => Promise.resolve(ada),
        loadMfa: () => Promise.resolve(stored),
        saveMfa: (_id, next) => {
          stored = next;

          return Promise.resolve();
        },
        deleteMfa: () => {
          stored = undefined;

          return Promise.resolve();
        },
        ...extra
      },
      config: {
        verifyPassword: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
        hashPassword: plain => Promise.resolve(`hash:${plain}`)
      }
    });

    return { api, tokens, current: () => stored };
  };

  const enrol = async () => {
    const harness = withMfa();
    const begun = body(await harness.api.mfa.begin(actorFor(ada)));
    const secret = begun.secret as string;
    await harness.api.mfa.confirm(actorFor(ada), totpCode(secret));

    return { ...harness, secret };
  };

  it('is not offered by a store that cannot keep one', async () => {
    expect(build().capabilities.mfa).toBe(false);
    expect(await build().mfa.begin(actorFor(ada))).toMatchObject({ status: 404 });
  });

  it('hands back a secret and a URI an app can scan', async () => {
    const { api } = withMfa();
    const outcome = body(await api.mfa.begin(actorFor(ada)));

    expect(outcome.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(outcome.uri).toContain('otpauth://totp/');
    expect(outcome.uri).toContain('issuer=https%3A%2F%2Facme.test');
  });

  /** An enrolment nobody proved must not be enforced, or a scan that failed locks the account out of itself. */
  it('does not take effect until a real code confirms it', async () => {
    const { api, current } = withMfa();
    await api.mfa.begin(actorFor(ada));

    expect(current()?.confirmedAt).toBeUndefined();
    expect(body(await api.mfa.status(actorFor(ada)))).toMatchObject({ enabled: false, pending: true });
    expect(body(await api.login({ username: 'ada', password: 'pw' }))).not.toHaveProperty('mfaRequired');
  });

  it('refuses to confirm with the wrong code', async () => {
    const { api, current } = withMfa();
    await api.mfa.begin(actorFor(ada));

    expect(await api.mfa.confirm(actorFor(ada), '000000')).toMatchObject({ status: 401 });
    expect(current()?.confirmedAt).toBeUndefined();
  });

  it('hands the recovery codes over exactly once, and stores them hashed', async () => {
    const { api, current, secret } = await enrol();
    const codes = (body(await api.mfa.confirm(actorFor(ada), totpCode(secret))) as { recoveryCodes?: string[] })
      .recoveryCodes;

    // Already confirmed, so a second confirm is refused rather than minting a new set.
    expect(codes).toBeUndefined();
    for (const digest of current()?.recoveryCodes ?? []) {
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('turns sign-in into two steps once it is on', async () => {
    const { api } = await enrol();
    const outcome = await api.login({ username: 'ada', password: 'pw' });

    expect(body(outcome)).toMatchObject({ mfaRequired: true });
    expect(body(outcome).mfaToken).toEqual(expect.any(String));
    // No session yet: the password alone bought a challenge, not authority.
    expect(outcome.ok && outcome.session).toBeUndefined();
  });

  it('finishes the sign-in with a code from the app', async () => {
    const { api, secret } = await enrol();
    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;

    const outcome = await api.completeMfa(challenge, totpCode(secret));

    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.session?.token).toEqual(expect.any(String));
  });

  it('refuses the wrong code, and anything that is not a challenge', async () => {
    const { api } = await enrol();
    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;

    expect(await api.completeMfa(challenge, '000000')).toMatchObject({ status: 401 });
    expect(await api.completeMfa('not-a-token', '000000')).toMatchObject({ status: 401 });
  });

  /** A challenge is not a session: it must not be usable as one anywhere else. */
  it('mints a challenge that does not verify as a session token', async () => {
    const { api, tokens } = await enrol();
    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;

    expect(tokens.verifyUserToken(challenge).ok).toBe(false);
  });

  it('accepts a recovery code and spends it', async () => {
    const { api, current } = withMfa();
    const begun = body(await api.mfa.begin(actorFor(ada)));
    const codes = (
      body(await api.mfa.confirm(actorFor(ada), totpCode(begun.secret as string))) as {
        recoveryCodes: string[];
      }
    ).recoveryCodes;

    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;
    const before = current()?.recoveryCodes?.length ?? 0;

    const outcome = await api.completeMfa(challenge, codes[0]);

    expect(outcome).toMatchObject({ ok: true });
    expect(body(outcome)).toMatchObject({ recoveryCodeUsed: true });
    expect(current()?.recoveryCodes).toHaveLength(before - 1);
  });

  it('refuses a recovery code that has already been spent', async () => {
    const { api } = withMfa();
    const begun = body(await api.mfa.begin(actorFor(ada)));
    const codes = (
      body(await api.mfa.confirm(actorFor(ada), totpCode(begun.secret as string))) as {
        recoveryCodes: string[];
      }
    ).recoveryCodes;

    const first = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;
    await api.completeMfa(first, codes[0]);

    const second = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;
    expect(await api.completeMfa(second, codes[0])).toMatchObject({ status: 401 });
  });

  it('asks for the password before removing the factor', async () => {
    const { api, current } = await enrol();

    expect(await api.mfa.disable(actorFor(ada), 'wrong')).toMatchObject({ status: 401 });
    expect(current()?.confirmedAt).toEqual(expect.any(Number));

    expect(await api.mfa.disable(actorFor(ada), 'pw')).toMatchObject({ ok: true });
    expect(current()).toBeUndefined();
  });

  it('refuses to enrol a second factor over a confirmed one', async () => {
    const { api } = await enrol();

    expect(await api.mfa.begin(actorFor(ada))).toMatchObject({ status: 409 });
  });
});

describe('security events', () => {
  const withEvents = (adapters: Partial<AccountAdapters> = {}) => {
    const seen: SecurityEvent[] = [];
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findByUsername: () => Promise.resolve(ada),
        findById: () => Promise.resolve(ada),
        ...adapters
      },
      config: {
        verifyPassword: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
        hashPassword: plain => Promise.resolve(`hash:${plain}`),
        onEvent: event => seen.push(event)
      }
    });

    return { api, seen };
  };

  it('reports a sign-in and a failed one differently', async () => {
    const { api, seen } = withEvents();

    await api.login({ username: 'ada', password: 'pw' });
    await api.login({ username: 'ada', password: 'wrong' });

    expect(seen.map(event => event.type)).toEqual(['login', 'login.failed']);
    expect(seen[0]).toMatchObject({ userId: 1, at: expect.any(Number) as number });
  });

  it('names the administrator as well as the account, when they differ', async () => {
    const { api, seen } = withEvents({ setStatus: () => Promise.resolve() });
    const admin = actorFor({ ...ada, id: 9 }, ['userManage']);

    await api.admin.setStatus(admin, 1, 'blocked');

    expect(seen[0]).toMatchObject({ type: 'admin.status-changed', userId: 1, actorId: 9 });
  });

  /** A logging outage must not become an authentication outage. */
  it('survives a handler that throws', async () => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findByUsername: () => Promise.resolve(ada)
      },
      config: {
        verifyPassword: () => Promise.resolve(true),
        onEvent: () => {
          throw new Error('the SIEM is down');
        }
      }
    });

    expect(await api.login({ username: 'ada', password: 'pw' })).toMatchObject({ ok: true });
  });
});

describe('the longest a session may live', () => {
  const capped = (sessionStartedAt: number) => {
    const tokens = createTokens({ secret: 's', issuer: 'https://test', lifetimes: { session: 3600 } });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });
    const clearSession = vi.fn(() => Promise.resolve());

    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession,
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findByRefreshToken: () =>
          Promise.resolve({ ...ada, refreshExpiresAt: Math.floor(Date.now() / 1000) + 9999, sessionStartedAt })
      },
      config: {}
    });

    return { api, clearSession };
  };

  /** The renewal window is already an idle timeout. This is the other half: the session that renews forever. */
  it('ends a session that has been renewing past the cap', async () => {
    const { api, clearSession } = capped(Math.floor(Date.now() / 1000) - 7200);
    const outcome = await api.refresh('r-1');

    expect(outcome).toMatchObject({ ok: false, status: 401 });
    expect(body(outcome)).toMatchObject({ reason: 'expired' });
    // Ended, not merely refused — otherwise the row lingers until its refresh token ages out.
    expect(clearSession).toHaveBeenCalledWith({ refreshToken: 'r-1' });
  });

  it('renews one that is still inside it', async () => {
    const { api } = capped(Math.floor(Date.now() / 1000) - 60);

    expect(await api.refresh('r-1')).toMatchObject({ ok: true });
  });

  it('is off by default, so a session renews for as long as somebody uses it', async () => {
    const api = build({
      findByRefreshToken: () =>
        Promise.resolve({ ...ada, refreshExpiresAt: Math.floor(Date.now() / 1000) + 9999, sessionStartedAt: 0 })
    });

    expect(await api.refresh('r-1')).toMatchObject({ ok: true });
  });
});

describe('signing in with a code instead of a password', () => {
  const passwordless = (extra: Partial<AccountAdapters> = {}) => {
    const codes: {
      id: number;
      purpose: string;
      identifier: string;
      codeHash: string;
      expiresAt: number;
      userId?: number;
    }[] = [];
    const sent: { to: string; data: Record<string, string> }[] = [];
    const tokens = createTokens({ secret: 's', issuer: 'https://test' });
    const identity = createIdentity({
      tokens,
      carriers: createCarriers(() => 'sess'),
      presentedOrigin,
      adapters: { findAccountByToken: () => Promise.resolve(undefined) }
    });

    const api = createAuthApi({
      tokens,
      identity,
      adapters: {
        saveSession: () => Promise.resolve(),
        clearSession: () => Promise.resolve(),
        loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
        findByEmail: address => Promise.resolve(address === ada.email ? ada : undefined),
        findById: () => Promise.resolve(ada),
        sendMail: message => {
          sent.push({ to: message.to, data: message.data });

          return Promise.resolve();
        },
        saveOtp: entry => {
          codes.push({ id: codes.length + 1, ...entry });

          return Promise.resolve();
        },
        findOtp: (purpose, identifier) =>
          Promise.resolve(codes.filter(entry => entry.purpose === purpose && entry.identifier === identifier).at(-1)),
        consumeOtp: id => {
          const index = codes.findIndex(entry => entry.id === id);
          if (index >= 0) {
            codes.splice(index, 1);
          }

          return Promise.resolve();
        },
        ...extra
      },
      config: { generateToken: () => 'CODE123', hashPassword: plain => Promise.resolve(`hash:${plain}`) }
    });

    return { api, codes, sent };
  };

  it('is not offered by a store that cannot keep a code or send mail', () => {
    expect(build().capabilities.passwordless).toBe(false);
  });

  it('emails a code and signs the person in with it', async () => {
    const { api, sent } = passwordless();

    expect(await api.passwordless.request(ada.email)).toMatchObject({ ok: true });
    expect(sent[0]).toMatchObject({ to: ada.email });

    const outcome = await api.passwordless.complete(ada.email, sent[0].data.code);

    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.session?.token).toEqual(expect.any(String));
  });

  /** Anything else makes this endpoint a way to ask which addresses have accounts. */
  it('answers a stranger’s address identically, and sends nothing', async () => {
    const { api, sent } = passwordless();

    const known = await api.passwordless.request(ada.email);
    const unknown = await api.passwordless.request('nobody@example.test');

    expect(unknown.ok && unknown.body).toEqual(known.ok && known.body);
    expect(sent).toHaveLength(1);
  });

  it('spends the code, so it cannot be used twice', async () => {
    const { api, sent } = passwordless();
    await api.passwordless.request(ada.email);
    const code = sent[0].data.code;

    expect(await api.passwordless.complete(ada.email, code)).toMatchObject({ ok: true });
    expect(await api.passwordless.complete(ada.email, code)).toMatchObject({ status: 401 });
  });

  it('refuses the wrong code and an expired one', async () => {
    const { api, codes, sent } = passwordless();
    await api.passwordless.request(ada.email);

    expect(await api.passwordless.complete(ada.email, 'WRONG')).toMatchObject({ status: 401 });

    codes[0].expiresAt = Math.floor(Date.now() / 1000) - 1;
    expect(await api.passwordless.complete(ada.email, sent[0].data.code)).toMatchObject({ status: 401 });
  });

  it('never creates an account for an address that has none', async () => {
    const createAccount = vi.fn();
    const { api } = passwordless({ createAccount });

    await api.passwordless.request('nobody@example.test');

    expect(createAccount).not.toHaveBeenCalled();
  });

  /**
   * Arriving by email proves the address, which is ONE factor. Skipping the second because somebody asked for a
   * link would make enrolling it decorative.
   */
  it('still owes a second factor when one is enrolled', async () => {
    const { api, sent } = passwordless({
      loadMfa: () => Promise.resolve({ secret: 'x', confirmedAt: 1 }),
      saveMfa: () => Promise.resolve()
    });
    await api.passwordless.request(ada.email);

    expect(body(await api.passwordless.complete(ada.email, sent[0].data.code))).toMatchObject({ mfaRequired: true });
  });
});

/**
 * Support acting AS somebody. The flow is small; what has to hold is that the session it hands out is visibly
 * borrowed, cannot outlive its errand, and is not something an ordinary administrator quietly acquired.
 */
describe('impersonation', () => {
  const verifier = createTokens({ secret: 'test-secret', issuer: 'https://test' });
  const bob: AccountRecord = { id: 2, username: 'bob', email: 'bob@example.test', active: true, verified: true };

  const impersonating = (overrides: Partial<AccountAdapters> = {}, config: AuthApiConfig = {}) => {
    const events: SecurityEvent[] = [];
    const api = build(
      { findById: id => Promise.resolve(id === bob.id ? bob : undefined), ...overrides },
      { impersonationPermission: 'impersonate', onEvent: event => events.push(event), ...config }
    );

    return { api, events };
  };

  const admin = actorFor(ada, ['userManage', 'impersonate']);

  /** The default is no impersonation at all — naming the capability is how a deployment asks for it. */
  it('is not offered until the deployment names the permission it takes', async () => {
    const api = build({ findById: () => Promise.resolve(bob) });

    expect(api.capabilities.impersonation).toBe(false);
    expect(await api.admin.impersonate(admin, bob.id)).toMatchObject({ ok: false, status: 404 });
  });

  /** Being able to suspend an account and being able to become one are not the same grant. */
  it('refuses an administrator who only holds the ordinary admin permission', async () => {
    const { api } = impersonating();

    expect(await api.admin.impersonate(actorFor(ada, ['userManage']), bob.id)).toMatchObject({
      ok: false,
      status: 403
    });
  });

  it('refuses a stranger and refuses yourself', async () => {
    const { api } = impersonating();

    expect(await api.admin.impersonate(undefined, bob.id)).toMatchObject({ ok: false, status: 401 });
    expect(await api.admin.impersonate(admin, ada.id)).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses an account that does not exist, or one that is not allowed a session', async () => {
    const { api } = impersonating({ findById: () => Promise.resolve(undefined) });
    expect(await api.admin.impersonate(admin, 404)).toMatchObject({ ok: false, status: 404 });

    const blocked = impersonating({ findById: () => Promise.resolve({ ...bob, active: false }) });
    expect(await blocked.api.admin.impersonate(admin, bob.id)).toMatchObject({ ok: false, status: 403 });
  });

  /** `act` is the registered claim for delegation, so a borrowed session can be told from a real one downstream. */
  it('mints a session that says who is really behind it', async () => {
    const { api } = impersonating();
    const outcome = await api.admin.impersonate(admin, bob.id);
    const token = body(outcome).access_token as string;

    const verified = verifier.verifyUserToken(token);

    expect(verified.ok && verified.payload.sub).toBe('2');
    expect(verified.ok && verified.payload.act).toEqual({ sub: '1' });
    expect(body(outcome)).toMatchObject({ impersonatedBy: 1, details: { username: 'bob' } });
  });

  /** Fifteen minutes and no way to extend it. A borrowed session that renews is a second key to the account. */
  it('cannot be renewed, and expires on its own', async () => {
    const { api } = impersonating();
    const outcome = await api.admin.impersonate(admin, bob.id);

    expect(body(outcome).refresh_token).toBeUndefined();
    expect(body(outcome).expire_in).toBeLessThanOrEqual(15 * 60);
  });

  /**
   * No cookie. Writing this session over the administrator's own would sign them out of the account they administer
   * from — so the credential is answered, and whoever asked decides where to put it.
   */
  it('does not touch the cookies of whoever asked', async () => {
    const { api } = impersonating();
    const outcome = await api.admin.impersonate(admin, bob.id);

    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.session).toBeUndefined();
  });

  it('is written down, naming both sides', async () => {
    const { api, events } = impersonating();
    await api.admin.impersonate(admin, bob.id);

    expect(events).toContainEqual(expect.objectContaining({ type: 'admin.impersonated', userId: 2, actorId: 1 }));
  });
});

/**
 * A link mailed out has to stop working. One sitting in an inbox, a mail archive or a support ticket is a password
 * — and until now every one of them was good forever.
 *
 * The deadline rides INSIDE the token rather than in a column, which is what makes it impossible for a deployment
 * with its own store to be quietly without it. It is not a secret: the token is compared against the stored copy,
 * so editing the deadline produces a string that matches no row.
 */
describe('links that expire', () => {
  const stored: { reset?: string; validation?: string; pending?: string } = {};

  const mailing = (config: AuthApiConfig = {}, account: AccountRecord = ada) => {
    const sent: { template: string; data: Record<string, string> }[] = [];
    const api = build(
      {
        findByEmail: () => Promise.resolve(account),
        findById: () => Promise.resolve(ada),
        updateAccount: (_id, changes) => Promise.resolve({ ...ada, ...changes }),
        setPassword: () => Promise.resolve(),
        setResetToken: (_id, token) => {
          stored.reset = token;

          return Promise.resolve();
        },
        findByResetToken: token => Promise.resolve(token === stored.reset ? account : undefined),
        setValidationToken: (_id, token) => {
          stored.validation = token;

          return Promise.resolve();
        },
        findByValidationToken: token => Promise.resolve(token === stored.validation ? account : undefined),
        setVerified: () => Promise.resolve(),
        setPendingEmail: (_id, _email, token) => {
          stored.pending = token;

          return Promise.resolve();
        },
        findByPendingEmail: token =>
          Promise.resolve(token === stored.pending ? { account, email: 'elsewhere@example.test' } : undefined),
        clearPendingEmail: () => Promise.resolve(),
        sendMail: message => {
          sent.push(message);

          return Promise.resolve();
        }
      },
      { generateToken: () => `r${sent.length}`, ...config }
    );

    return { api, sent };
  };

  const travel = (seconds: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + seconds * 1000);
  };

  afterEach(() => vi.useRealTimers());

  const unverified: AccountRecord = { ...ada, verified: false };

  it('stamps a deadline on every link it mails', async () => {
    const { api, sent } = mailing({}, unverified);

    await api.forgotPassword(ada.email);
    await api.resendVerification(ada.email);

    expect(sent[0].data.resetToken).toMatch(/~\d+$/);
    expect(sent[1].data.validationToken).toMatch(/~\d+$/);
  });

  it('resets a password within the hour and not after it', async () => {
    const { api, sent } = mailing();
    await api.forgotPassword(ada.email);
    const link = sent[0].data.resetToken;

    travel(2 * 3600);
    expect(await api.resetPassword(link, 'n3wPassw0rd')).toMatchObject({ ok: false, status: 400 });

    vi.useRealTimers();
    expect(await api.resetPassword(link, 'n3wPassw0rd')).toMatchObject({ ok: true });
  });

  it('confirms an address within the day and not after it', async () => {
    const { api, sent } = mailing();
    await api.updateProfile(actorFor(ada), { email: 'elsewhere@example.test' });
    const link = sent[0].data.confirmationToken;

    travel(48 * 3600);
    expect(await api.confirmEmailChange(link)).toMatchObject({ ok: false, status: 400 });

    vi.useRealTimers();
    expect(await api.confirmEmailChange(link)).toMatchObject({ ok: true });
  });

  it('validates an account within the day and not after it', async () => {
    const { api, sent } = mailing({}, unverified);
    await api.resendVerification(ada.email);
    const link = sent[0].data.validationToken;

    travel(48 * 3600);
    expect(await api.validateAccount(link)).toMatchObject({ ok: false, status: 400 });

    vi.useRealTimers();
    expect(await api.validateAccount(link)).toMatchObject({ ok: true });
  });

  /** The links already in people's inboxes when a deployment upgrades. No `~`, no deadline, still good. */
  it('keeps honouring a token minted before any of this existed', async () => {
    const { api } = mailing();
    stored.reset = 'an-old-token';

    expect(await api.resetPassword('an-old-token', 'n3wPassw0rd')).toMatchObject({ ok: true });
  });

  /** Editing the deadline just produces a string that matches no stored row. */
  it('cannot be extended by rewriting it', async () => {
    const { api, sent } = mailing();
    await api.forgotPassword(ada.email);
    const forged = `${sent[0].data.resetToken.split('~')[0]}~${Math.floor(Date.now() / 1000) + 999_999}`;

    expect(await api.resetPassword(forged, 'n3wPassw0rd')).toMatchObject({ ok: false, status: 400 });
  });
});
