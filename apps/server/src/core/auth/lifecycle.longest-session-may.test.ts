import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthApi } from './api';
import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { TOKENS, actorFor, ada, body, build } from './tests/lifecycle';
import { createTokens } from './tokens';

import type { AccountAdapters, AccountRecord, AuthApiConfig, SecurityEvent } from './api';

/** A refresh credential `build`'s deployment signed, as renewal verifies one before asking the store about it. */
const refreshTokenFor = (userId: number): string => createTokens(TOKENS).generateRefreshToken(userId);

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

    return { api, clearSession, refreshToken: tokens.generateRefreshToken(ada.id) };
  };

  /** The renewal window is already an idle timeout. This is the other half: the session that renews forever. */
  it('ends a session that has been renewing past the cap', async () => {
    const { api, clearSession, refreshToken } = capped(Math.floor(Date.now() / 1000) - 7200);
    const outcome = await api.refresh(refreshToken);

    expect(outcome).toMatchObject({ ok: false, status: 401 });
    expect(body(outcome)).toMatchObject({ reason: 'expired' });
    // Ended, not merely refused — otherwise the row lingers until its refresh token ages out.
    expect(clearSession).toHaveBeenCalledWith({ refreshToken });
  });

  it('renews one that is still inside it', async () => {
    const { api, refreshToken } = capped(Math.floor(Date.now() / 1000) - 60);

    expect(await api.refresh(refreshToken)).toMatchObject({ ok: true });
  });

  it('is off by default, so a session renews for as long as somebody uses it', async () => {
    const api = build({
      findByRefreshToken: () =>
        Promise.resolve({ ...ada, refreshExpiresAt: Math.floor(Date.now() / 1000) + 9999, sessionStartedAt: 0 })
    });

    expect(await api.refresh(refreshTokenFor(ada.id))).toMatchObject({ ok: true });
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
/**
 * The noise this exists to stop: a browser holding the readable hint cookie, whose refresh token is dead.
 *
 * The hint outlives the access token ON PURPOSE — it advertises the renewal window, which is what lets a page know
 * a lapsed session can still be recovered without asking. So a visitor who is NOT signed in, and knows it, still
 * has a reason to call `/auth/refresh` on every page load, and gets a 401 every time. Only the server can retract
 * that claim, and until now a refusal retracted nothing.
 */
describe('a refusal that ends the session', () => {
  const live = { ...ada, refreshExpiresAt: Math.floor(Date.now() / 1000) + 3600 };
  const refreshToken = refreshTokenFor(ada.id);

  it('says so when the credential can never work again', async () => {
    const forged = await build({ findByRefreshToken: () => Promise.resolve(live) }).refresh('r');
    const gone = await build({ findByRefreshToken: () => Promise.resolve(undefined) }).refresh(refreshToken);
    const lapsed = await build({
      findByRefreshToken: () => Promise.resolve({ ...ada, refreshExpiresAt: 1 })
    }).refresh(refreshToken);
    const blocked = await build({
      findByRefreshToken: () => Promise.resolve({ ...live, active: false })
    }).refresh(refreshToken);

    for (const outcome of [forged, gone, lapsed, blocked]) {
      expect(outcome).toMatchObject({ ok: false, status: 401 });
      expect(!outcome.ok && outcome.endSession).toBe(true);
    }
  });

  /** A renewal that worked, and one that was never offered, have nothing to clear. */
  it('says nothing of the sort when there is a session to keep', async () => {
    const renewed = await build({ findByRefreshToken: () => Promise.resolve(live) }).refresh(refreshToken);
    const notOffered = await build().refresh(refreshToken);
    const noToken = await build({ findByRefreshToken: () => Promise.resolve(live) }).refresh('');

    expect(renewed.ok).toBe(true);
    expect(notOffered).toMatchObject({ ok: false, status: 404 });
    expect(!notOffered.ok && notOffered.endSession).toBeUndefined();
    expect(!noToken.ok && noToken.endSession).toBeUndefined();
  });
});
