import { describe, expect, it, vi } from 'vitest';

import { createAuthApi } from './api';
import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { actorFor, ada, body, build } from './tests/lifecycle';
import { createTokens } from './tokens';
import { totpCode } from './totp';

import type { AccountAdapters, MfaRecord, SecurityEvent } from './api';

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

  /** The code the app shows NEXT: the one on screen now was spent proving the enrolment. */
  const nextCode = (secret: string) => totpCode(secret, Date.now() + 30_000);

  it('finishes the sign-in with a code from the app', async () => {
    const { api, secret } = await enrol();
    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;

    const outcome = await api.completeMfa(challenge, nextCode(secret));

    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.session?.token).toEqual(expect.any(String));
  });

  /**
   * A code is valid for its whole window. Without remembering which step was last accepted, one seen over a shoulder or
   * lifted by a phishing page signs a second person in within that window — RFC 6238 §5.2 forbids exactly this.
   */
  it('refuses a code that already signed somebody in, and any older one', async () => {
    const { api, secret, current } = await enrol();
    const code = nextCode(secret);
    const first = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;
    expect(await api.completeMfa(first, code)).toMatchObject({ ok: true });

    const second = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;
    expect(await api.completeMfa(second, code)).toMatchObject({ status: 401 });
    expect(await api.completeMfa(second, totpCode(secret))).toMatchObject({ status: 401 });
    expect(current()?.lastUsedStep).toEqual(expect.any(Number));
  });

  it('refuses the code that proved the enrolment as a way in', async () => {
    const { api } = withMfa();
    const begun = body(await api.mfa.begin(actorFor(ada)));
    const code = totpCode(begun.secret as string);
    await api.mfa.confirm(actorFor(ada), code);
    const challenge = body(await api.login({ username: 'ada', password: 'pw' })).mfaToken as string;

    expect(await api.completeMfa(challenge, code)).toMatchObject({ status: 401 });
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
