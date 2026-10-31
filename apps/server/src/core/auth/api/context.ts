import { createHash } from 'node:crypto';

import { serverLog } from '../../../helpers/serverLog';
import { checkPermission } from '../authorize';
import {
  generateToken as defaultGenerateToken,
  hashPassword as defaultHashPassword,
  verifyPassword as defaultVerifyPassword
} from '../passwords';
import { createMemoryRateLimit, fleetRateLimit } from '../throttle';
import { normalizeRecoveryCode } from '../totp';
import { refuse, now, clientOf } from './values';

import type { CredentialCarrier } from '../credentials';
import type { Actor, Identity } from '../identity';
import type { Tokens } from '../tokens';
import type {
  AccountRecord,
  AccountAccess,
  SecurityEvent,
  SessionContext,
  AccountAdapters,
  ThrottleAttempt,
  AuthApiConfig,
  ExchangeResult,
  AuthOutcome
} from './types';
import type { SSRSession } from '@plitzi/sdk-shared';

/** What every flow of the auth API shares: the adapters and the settings, read once, and the steps they take alike. */
export const createAuthContext = ({
  tokens,
  identity,
  adapters,
  config = {}
}: {
  tokens: Tokens;
  identity: Identity;
  adapters: AccountAdapters;
  config?: AuthApiConfig;
}) => {
  const {
    verifyPassword = defaultVerifyPassword,
    hashPassword = defaultHashPassword,
    generateToken = defaultGenerateToken,
    verifyOnSignup = false,
    terms,
    adminPermission = 'userManage',
    impersonationPermission,
    password: policy = {},
    rateLimit = fleetRateLimit() ?? createMemoryRateLimit(),
    onMailError,
    onEvent,
    mfaIssuer,
    csrf
  } = config;

  /** Never awaited, never able to throw: a logging outage must not become an authentication outage. */
  const record = (event: Omit<SecurityEvent, 'at'>): void => {
    if (!onEvent) {
      return;
    }

    try {
      onEvent({ ...event, at: Math.floor(Date.now() / 1000) });
    } catch (error: unknown) {
      serverLog.error('auth', 'security event handler threw', error);
    }
  };

  /**
   * A single-use link token that stops working.
   *
   * The deadline is carried **inside the token**, after a `~`, and that is what makes this cost nothing: no column,
   * no adapter argument, and nothing a deployment with its own store has to remember to enforce — which is the
   * failure mode of putting the check in the adapters, where forgetting it is silent and looks like everything
   * working. It is not a secret and does not need to be: the token is compared against the stored copy, so editing
   * the deadline just produces a string that matches no row.
   *
   * A token issued before this existed has no `~`, reads as no deadline, and keeps working — the links already in
   * people's inboxes when a deployment upgrades.
   */
  const mintLink = (random: string, lifetime: number): string => `${random}~${now() + lifetime}`;

  const linkExpired = (token: string): boolean => {
    const deadline = Number(token.slice(token.lastIndexOf('~') + 1));

    return Number.isFinite(deadline) && token.includes('~') && deadline < now();
  };

  /** Recovery codes are high-entropy, so a fast digest is right — scrypt ten times per sign-in would not be. */
  const digestRecoveryCode = (code: string): string =>
    createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');

  /**
   * Sends, and never fails the flow if it cannot.
   *
   * Every one of these goes out AFTER something has already been committed — an account created, an address
   * changed, a reset token stored. Letting the mail provider decide whether that request succeeded turns an
   * outage at Brevo into a 500 on a change that did happen, which is the worst of both: the caller is told it
   * failed and retries against the new state. Reported instead, and the person can ask for another.
   */
  const deliver = async (message: { to: string; template: string; data: Record<string, string> }): Promise<void> => {
    try {
      await adapters.sendMail?.(message);
    } catch (error: unknown) {
      const report = onMailError ?? ((cause: unknown) => serverLog.error('auth', 'could not send mail', cause));
      report(error, { to: message.to, template: message.template });
    }
  };

  /**
   * Checked before the password is, so a throttled attempt costs no hash — which is the difference between a rate
   * limit and a slightly slower way to be brute-forced.
   */
  /** Whatever was counted against this key is forgiven: the attempt it was guarding against succeeded. */
  const throttleSucceeded = (attempt: Omit<ThrottleAttempt, 'succeeded'>): void => {
    void Promise.resolve(rateLimit({ ...attempt, succeeded: true })).catch(() => undefined);
  };

  const throttled = async (attempt: ThrottleAttempt): Promise<AuthOutcome | undefined> => {
    const verdict = await rateLimit(attempt);
    const allowed = typeof verdict === 'boolean' ? verdict : verdict.allowed;
    if (allowed) {
      return undefined;
    }

    const retryAfter = typeof verdict === 'boolean' ? undefined : verdict.retryAfter;

    return {
      ok: false,
      status: 429,
      body: { error: 'Too many attempts', ...(retryAfter !== undefined ? { retryAfter } : {}) }
    };
  };

  /** The one place a new password is judged, so signing up, resetting and changing cannot disagree about it. */
  const rejectPassword = async (
    value: string,
    context: { username?: string; email?: string } = {}
  ): Promise<AuthOutcome | undefined> => {
    const minLength = policy.minLength ?? 8;
    if (value.length < minLength) {
      return refuse(400, `The password must be at least ${minLength} characters`);
    }

    const reason = await policy.validate?.(value, context);

    return reason ? refuse(400, reason) : undefined;
  };

  /**
   * What this deployment offers, decided by what it supplied and nothing else.
   *
   * There used to be a parallel set of `features` switches. They were redundant in every case — each flow reads
   * adapters that no other flow reads, so leaving one out is already how you decline it — and two ways of saying
   * the same thing invite the state where they disagree: an adapter wired up, the flag forgotten, and an endpoint
   * that answers 404 for no reason anyone can see. Declining a flow is now one act: do not implement it.
   */
  const capabilities = {
    passwordLogin: !!adapters.findByUsername,
    refresh: !!adapters.findByRefreshToken,
    signup: !!adapters.createAccount,
    passwordReset: !!adapters.findByEmail && !!adapters.setResetToken,
    emailVerification: !!adapters.findByValidationToken && !!adapters.setVerified,
    exchange: !!adapters.exchangeCredential,
    mfa: !!adapters.loadMfa && !!adapters.saveMfa,
    passwordless: !!adapters.saveOtp && !!adapters.findOtp && !!adapters.findByEmail && !!adapters.sendMail,
    profile: !!adapters.updateAccount,
    passwordChange: !!adapters.findById && !!adapters.setPassword,
    accountDeletion: !!adapters.deleteAccount,
    sessionList: !!adapters.listSessions,
    administration: !!adapters.listAccounts && !!adapters.findById,
    /** Changing an address by confirming it, rather than on the spot. Needs somewhere to park it and a way to write. */
    emailChange:
      !!adapters.setPendingEmail &&
      !!adapters.findByPendingEmail &&
      !!adapters.clearPendingEmail &&
      !!adapters.updateAccount &&
      !!adapters.sendMail,
    /** Off unless the deployment named the capability it takes — see `impersonationPermission`. */
    impersonation: !!impersonationPermission && !!adapters.findById
  };

  /**
   * An administrator acting on somebody else.
   *
   * `subject` refuses the case where that somebody is themselves. Banning or deleting your own account through the
   * admin surface is how a deployment loses its last administrator, and it is never what was meant: closing your
   * own account is the self-service flow, which asks for a password precisely because it is irreversible.
   */
  const requireAdmin = (actor: Actor | undefined, subject?: number): AuthOutcome | undefined => {
    const check = checkPermission(actor, adminPermission);
    if (!check.ok) {
      return refuse(check.status, check.error, check.status === 401 ? 'missing' : undefined);
    }

    if (subject !== undefined && subject === actor?.id) {
      return refuse(400, 'Use the self-service route to act on your own account');
    }

    return undefined;
  };

  /**
   * A session for this account. `options` is only for the one that is not an ordinary sign-in: a borrowed session
   * carries who borrowed it and cannot renew itself, so it dies at its deadline instead of quietly living for a
   * month behind a refresh token.
   */
  const issue = async (
    userId: number,
    context?: SessionContext,
    options: { actingAs?: number; ttlSeconds?: number; renewable?: boolean } = {}
  ): Promise<SSRSession> => {
    const { actingAs, ttlSeconds, renewable = true } = options;
    const now = Math.floor(Date.now() / 1000);
    const session: SSRSession = {
      token: tokens.generateUserToken(userId, { actingAs, ttlSeconds }),
      expiresAt: now + (ttlSeconds ?? tokens.lifetimes.access),
      ...(renewable
        ? { refreshToken: tokens.generateRefreshToken(userId), refreshExpiresAt: now + tokens.lifetimes.refresh }
        : {})
    };

    await adapters.saveSession(userId, session, context);

    return session;
  };

  /**
   * The body a grant answers with. `details` is the same object the session endpoint returns, deliberately: it makes
   * a grant an identity, so a client that has just signed in or renewed knows who it is without a second request.
   */
  const grantBody = async (account: AccountRecord, session: SSRSession, loaded?: AccountAccess): Promise<object> => {
    const access = loaded ?? (await adapters.loadAccess(account.id));
    const now = Math.floor(Date.now() / 1000);

    return {
      success: true,
      details: {
        id: account.id,
        username: account.username,
        email: account.email,
        verified: account.verified,
        roles: access.roles,
        permissions: access.permissions
      },
      access_token: session.token,
      expire_in: Math.max(0, session.expiresAt - now),
      expire_at: session.expiresAt,
      refresh_token: session.refreshToken,
      refresh_expire_in: Math.max(0, (session.refreshExpiresAt ?? 0) - now),
      refresh_expire_at: session.refreshExpiresAt
    };
  };

  /**
   * Turning a credential from an external identity provider into a session here, answered in accounts.
   *
   * `offered` separates "this deployment does not do exchanges" from "that credential was refused" — a 404 and a
   * 401 respectively, and a caller that cannot tell them apart reports a misconfiguration as a bad password.
   */
  const exchangeAccount = async (
    provider: string,
    token: string,
    carrier: CredentialCarrier
  ): Promise<ExchangeResult> => {
    if (!capabilities.exchange) {
      return { ok: false, offered: false, status: 404, error: 'Not found' };
    }

    if (!provider || !token) {
      return { ok: false, offered: true, status: 400, error: 'A provider and a token are required' };
    }

    const limited = await throttled({ action: 'exchange', key: provider, carrier });
    if (limited) {
      return { ok: false, offered: true, status: 429, error: 'Too many attempts' };
    }

    const result = await adapters.exchangeCredential?.(provider, token, carrier);
    if (!result) {
      return { ok: false, offered: true, status: 401, error: 'Token Invalid', reason: 'revoked' };
    }

    if ('error' in result) {
      return { ok: false, offered: true, status: result.status ?? 400, error: result.error, reason: 'revoked' };
    }

    return {
      ok: true,
      account: result,
      access: await adapters.loadAccess(result.id),
      session: await issue(result.id, { client: clientOf(carrier) })
    };
  };

  return {
    tokens,
    identity,
    adapters,
    verifyPassword,
    hashPassword,
    generateToken,
    verifyOnSignup,
    terms,
    adminPermission,
    impersonationPermission,
    policy,
    rateLimit,
    onMailError,
    onEvent,
    mfaIssuer,
    csrf,
    record,
    mintLink,
    linkExpired,
    digestRecoveryCode,
    deliver,
    throttleSucceeded,
    throttled,
    rejectPassword,
    capabilities,
    requireAdmin,
    issue,
    grantBody,
    exchangeAccount
  };
};

export type AuthContext = ReturnType<typeof createAuthContext>;
