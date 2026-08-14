import { createHash } from 'node:crypto';

import { checkPermission } from './authorize';
import {
  generateToken as defaultGenerateToken,
  hashPassword as defaultHashPassword,
  verifyPassword as defaultVerifyPassword
} from './passwords';
import { createMemoryRateLimit } from './throttle';
import { authFailureMessage } from './tokens';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  randomCode,
  totpUri,
  verifyTotp
} from './totp';

import type { CredentialCarrier } from './credentials';
import type { Csrf } from './csrf';
import type { Actor, Identity } from './identity';
import type { AuthFailure, Tokens } from './tokens';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * An account, as whatever stores accounts reports one. Deliberately not a user model: these are the only fields any
 * decision here is made on, and a deployment maps its own row onto them.
 */
export interface AccountRecord {
  id: number;
  username: string;
  email: string;
  /** Suspended, deactivated, whatever the deployment calls it — an inactive account never gets a session. */
  active: boolean;
  /** Confirmed their address. An unverified account may still sign in; what it may *do* is a matter for RBAC. */
  verified: boolean;
  /** Absent for accounts that have no password — one created through an identity provider, for instance. */
  passwordHash?: string;
  /** Unix seconds, for the refresh credential this account currently holds. */
  refreshExpiresAt?: number;
  /**
   * Unix seconds the session being renewed BEGAN, for `lifetimes.session` — the cap on how long one may live
   * however often it renews. Only `findByRefreshToken` needs to report it, and only a deployment that sets a cap.
   *
   * The renewal window is already an idle timeout: a session nobody refreshes dies with its refresh token. This is
   * the other half, and without it a session that renews quietly renews forever.
   */
  sessionStartedAt?: number;
}

export interface AccountAccess {
  roles: string[];
  permissions: string[];
}

/** What a session was created from, so a "your devices" list can name it. */
export interface SessionClient {
  userAgent?: string;
  ip?: string;
}

/**
 * What an account is allowed to be. `inactive` is the account's own doing (deactivated, never confirmed);
 * `blocked` is the deployment's. Neither may hold a session — the distinction is for whoever has to explain it.
 */
export type AccountStatus = 'active' | 'inactive' | 'blocked';

/** One live session, as its owner may see it. Never the credential itself. */
export interface SessionSummary {
  id: number;
  userAgent?: string;
  ip?: string;
  createdAt: number;
  expiresAt: number;
  /** The session asking. A device list without it invites someone to revoke the one they are using. */
  current: boolean;
}

/** A second factor as the store keeps it. `secret` is the TOTP seed; `recoveryCodes` are already hashed. */
export interface MfaRecord {
  secret: string;
  /** Unix seconds the enrolment was proven with a real code. Absent means started and never finished. */
  confirmedAt?: number;
  recoveryCodes?: string[];
}

/** Something worth writing down. Fed to an audit log, a webhook, a SIEM — whatever the deployment has. */
export interface SecurityEvent {
  type:
    | 'login'
    | 'login.failed'
    | 'login.mfa-required'
    | 'logout'
    | 'signup'
    | 'password.changed'
    | 'password.reset'
    | 'profile.changed'
    | 'email.changed'
    | 'account.deleted'
    | 'session.revoked'
    | 'mfa.enabled'
    | 'mfa.disabled'
    | 'mfa.failed'
    | 'admin.status-changed'
    | 'admin.roles-changed'
    | 'admin.account-deleted'
    | 'admin.impersonated';
  /** Who it happened to. Absent when the attempt named nobody that exists. */
  userId?: number;
  /** Who did it, when that is somebody else — an administrator acting on an account. */
  actorId?: number;
  at: number;
  detail?: Record<string, unknown>;
  carrier?: CredentialCarrier;
}

export interface AccountQuery {
  /** Matched against username and email. */
  search?: string;
  status?: AccountStatus;
  limit?: number;
  offset?: number;
}

/**
 * Why a session is being written — which is not something the pair itself can say, and the difference matters to
 * any store that keeps more than one session per account.
 *
 * A sign-in creates a session. A renewal **replaces one**, and a store that cannot tell them apart grows a row per
 * renewal: a device list that fills with ghosts of the same browser, and a revoked session that comes back because
 * the row it was meant to overwrite is still there. A store that keeps a single pair on the account row ignores
 * this and overwrites either way, which is what it always did.
 */
export interface SessionContext {
  /** The credential being renewed. Absent for a fresh sign-in. */
  replaces?: { refreshToken?: string; accessToken?: string };
  client?: SessionClient;
}

/** The user agent, off whatever carried the request. Nothing else here reads headers, so it is done once. */
const clientOf = (carrier?: CredentialCarrier): SessionClient | undefined => {
  const userAgent = carrier?.headers['user-agent'];

  return typeof userAgent === 'string' && userAgent ? { userAgent } : undefined;
};

/**
 * The account store, as auth needs to see it. Every method is optional except the three the session cycle cannot do
 * without, and **what is absent decides what this server offers**: a deployment with no `createAccount` has no
 * signup, and its route answers 404 rather than failing at runtime. That rule is what lets one server serve a
 * deployment with its own user table and one that signs everybody in through an external provider.
 */
export interface AccountAdapters {
  /**
   * Persist a freshly minted pair.
   *
   * `context` says whether this is a new session or one replacing another — see {@link SessionContext}. A store
   * with one pair per account may ignore it and overwrite; a store with a `session` table must not, or every
   * renewal leaves a row behind.
   */
  saveSession: (userId: number, session: SSRSession, context?: SessionContext) => Promise<void>;
  /** Clear the pair, by whichever half the caller holds, or by account. */
  clearSession: (target: { accessToken?: string; refreshToken?: string; userId?: number }) => Promise<void>;
  /** Global roles and permissions, for the body a grant answers with. */
  loadAccess: (userId: number) => Promise<AccountAccess>;

  /** By id. Needed wherever a flow acts on the account already signed in — changing a password, deleting itself. */
  findById?: (userId: number) => Promise<AccountRecord | undefined>;
  /**
   * Change what an account says about itself. Only the keys present are touched — an absent `email` means "leave
   * it", never "clear it", which is what an implementation writing every column unconditionally would do.
   */
  updateAccount?: (userId: number, changes: { username?: string; email?: string }) => Promise<AccountRecord>;
  /**
   * Suspend, block or restore. Separate from `deleteAccount` because they are different acts with different
   * consequences: a suspension is reversible and keeps everything the account made.
   */
  setStatus?: (userId: number, status: AccountStatus) => Promise<void>;
  /**
   * Erase the account. Whether that means deleting a row or anonymising one is the deployment's call and it is a
   * real one — content, audit logs and invoices usually have to outlive the person. Either way it must end every
   * session, which deleting the account's sessions does.
   */
  deleteAccount?: (userId: number) => Promise<void>;
  /** Page through accounts, for an administrator. `total` is the count before the page was taken. */
  listAccounts?: (query: AccountQuery) => Promise<{ accounts: AccountRecord[]; total: number }>;
  /** Replace an account's global roles with exactly these. */
  setRoles?: (userId: number, roles: string[]) => Promise<void>;
  /** The account's live sessions. `currentToken` marks the one asking, so a device list can say "this device". */
  listSessions?: (userId: number, currentToken?: string) => Promise<SessionSummary[]>;
  /** End one session. Scoped by account: a session id from another account must not resolve. */
  revokeSession?: (userId: number, sessionId: number) => Promise<boolean>;
  /** End every session except the one asking. */
  revokeOtherSessions?: (userId: number, currentToken: string) => Promise<number>;

  findByUsername?: (username: string) => Promise<AccountRecord | undefined>;
  findByRefreshToken?: (token: string) => Promise<AccountRecord | undefined>;
  createAccount?: (account: { username: string; email: string; passwordHash: string }) => Promise<AccountRecord>;
  findByEmail?: (email: string) => Promise<AccountRecord | undefined>;
  setPassword?: (userId: number, passwordHash: string) => Promise<void>;
  setResetToken?: (userId: number, token: string) => Promise<void>;
  findByResetToken?: (token: string) => Promise<AccountRecord | undefined>;
  setValidationToken?: (userId: number, token: string) => Promise<void>;
  findByValidationToken?: (token: string) => Promise<AccountRecord | undefined>;
  /**
   * Park an address the account asked to move to, with the token that will confirm it. It is NOT the account's
   * address yet, and nothing may sign in with it — the whole point is that the old one keeps working until the new
   * one is proven, so a typo is a nuisance instead of a lockout.
   *
   * Supplying these three (with `sendMail`) is what turns an email change into a confirmed one. A deployment that
   * leaves them out changes the address on the spot, which is the simpler thing and a legitimate choice.
   */
  setPendingEmail?: (userId: number, email: string, token: string) => Promise<void>;
  /** The account waiting on this confirmation, and the address it is waiting for. */
  findByPendingEmail?: (token: string) => Promise<{ account: AccountRecord; email: string } | undefined>;
  /** Forget the parked address — it was confirmed, superseded, or the account was closed. */
  clearPendingEmail?: (userId: number) => Promise<void>;
  /**
   * Confirm or un-confirm the address. Both directions from one adapter, because changing an email has to be able
   * to take verification away — a `markVerified` that only ever set it made that impossible to express.
   */
  setVerified?: (userId: number, verified: boolean) => Promise<void>;
  /**
   * A one-time code, hashed. `purpose` separates a sign-in link from anything else that uses the same table, and
   * `identifier` is what it was issued against — an email address, usually.
   */
  saveOtp?: (code: {
    purpose: string;
    identifier: string;
    codeHash: string;
    expiresAt: number;
    userId?: number;
  }) => Promise<void>;
  /** The live code for this purpose and identifier, if there is one. Expired rows may be returned or not. */
  findOtp?: (
    purpose: string,
    identifier: string
  ) => Promise<{ id: number; codeHash: string; expiresAt: number; userId?: number } | undefined>;
  /** Spend it. Deleting rather than flagging: a spent code that still exists is one a lookup can forget to exclude. */
  consumeOtp?: (id: number) => Promise<void>;
  /** The second factor for this account, if it has one. Without it, no MFA is offered at all. */
  loadMfa?: (userId: number) => Promise<MfaRecord | undefined>;
  saveMfa?: (userId: number, record: MfaRecord) => Promise<void>;
  deleteMfa?: (userId: number) => Promise<void>;
  /** Called for validation and password-reset mail. Without it neither flow is offered. */
  sendMail?: (message: { to: string; template: string; data: Record<string, string> }) => Promise<void>;
  /**
   * Turn a credential the browser obtained from an identity provider into an account here. Everything that decides
   * whether the credential is any good — which providers this deployment trusts, and that the token was minted for
   * *this* application — lives in the implementation, because only it knows.
   */
  exchangeCredential?: (
    provider: string,
    token: string,
    carrier: CredentialCarrier
  ) => Promise<AccountRecord | { error: string; status?: number } | undefined>;
}

/** What a flow was asked to do, for the throttle below. */
export type ThrottledAction =
  'login' | 'signup' | 'forgotPassword' | 'resetPassword' | 'changePassword' | 'exchange' | 'mfa' | 'passwordless';

export interface ThrottleAttempt {
  action: ThrottledAction;
  /** What is being attempted against — a username, an email, a token. Never a password. */
  key: string;
  carrier?: CredentialCarrier;
  /**
   * Not a question but a report: this one worked, so whatever was counted against the key can be forgotten. The
   * return value is ignored.
   *
   * It matters because the check happens BEFORE the password is examined — which is what makes a throttled attempt
   * cost no hash — so without this the counter cannot tell ten failures from ten sign-ins. An app that signs the
   * same account in repeatedly would lock it out by succeeding. A limiter that ignores this is simply stricter.
   */
  succeeded?: boolean;
}

export interface PasswordPolicy {
  /**
   * Default 8, which is NIST SP 800-63B's floor. There are deliberately no composition rules: requiring a digit
   * and a symbol measurably produces `Password1!` and nothing safer.
   */
  minLength?: number;
  /** Anything else this deployment decides — a breach-list lookup, a strength estimator. Return why, or nothing. */
  validate?: (password: string, context: { username?: string; email?: string }) => Promise<string | undefined>;
}

export interface AuthApiConfig {
  /**
   * How passwords are hashed and checked. **Defaults to scrypt from the standard library**, so a deployment that
   * has no opinion does not have to have one — and, more to the point, cannot end up with password login quietly
   * switched off because it did not supply a function it had no reason to know about.
   *
   * Supply both to keep an existing algorithm: a store full of bcrypt hashes needs bcrypt.
   */
  verifyPassword?: (plain: string, hash: string) => Promise<boolean>;
  hashPassword?: (plain: string) => Promise<string>;
  /** Opaque, single-use strings for validation and reset links. Defaults to 128 random bits, hex. */
  generateToken?: () => string;
  /** Whether a new account may sign in immediately or has to confirm its address first. */
  verifyOnSignup?: boolean;
  /**
   * The global capability an administrator must hold to act on somebody else's account. Named rather than fixed,
   * because what a deployment calls its permissions is its own vocabulary. Default `userManage`.
   */
  adminPermission?: string;
  /**
   * The capability that lets somebody obtain a session AS another account, and the switch that offers the flow at
   * all: **absent, there is no impersonation** and `/auth/admin/impersonate` answers 404.
   *
   * Deliberately its own permission rather than part of `adminPermission`. Support staff who can suspend an account
   * and support staff who can become one are not the same grant, and defaulting the second to the first would hand
   * it out to everybody who already had the first — a power that appears from an upgrade nobody read.
   */
  impersonationPermission?: string;
  /** What a password has to be. Applied wherever one is set: signing up, resetting, changing. */
  password?: PasswordPolicy;
  /**
   * May this attempt proceed? Answered **in memory by default**, so no deployment is unthrottled by omission.
   *
   * There used to be no default, on the reasoning that where the counter lives is a deployment decision. It is —
   * but the consequence of leaving it out was that the ordinary deployment shipped an unmetered password oracle,
   * because nobody configures an option they have not read about. The counting is per process; supply this to put
   * one counter behind the whole fleet, which is what a cluster wants.
   *
   * A refusal is a 429 with `retryAfter`, raised before any password is checked so it costs no hash.
   */
  rateLimit?: (attempt: ThrottleAttempt) => Promise<boolean | { allowed: boolean; retryAfter?: number }>;
  /** Where a failed delivery is reported. Defaults to `console.error`; it is never thrown — see `deliver`. */
  onMailError?: (error: unknown, message: { to: string; template: string }) => void;
  /**
   * Every act worth recording, as it happens.
   *
   * An audit trail, a webhook, an alert on ten failed sign-ins — all the same feed, and none of them something the
   * server should decide the shape of. Never awaited and never allowed to fail a request: a logging outage must
   * not become an authentication outage.
   */
  onEvent?: (event: SecurityEvent) => void;
  /** What an authenticator app calls this deployment when somebody enrols. Defaults to the token issuer. */
  mfaIssuer?: string;
  /** Set by `createAuth`, so `GET /auth/csrf` can mint one. Nothing here enforces the check — the routes do. */
  csrf?: Csrf;
}

/** What an exchange came to, before it is turned into either an HTTP body or a rendered page's session. */
export type ExchangeResult =
  | { ok: true; account: AccountRecord; access: AccountAccess; session: SSRSession }
  | { ok: false; offered: boolean; status: number; error: string; reason?: AuthFailure };

/** What a handler answers: a body, and optionally what should happen to the session cookies. */
export type AuthOutcome =
  | { ok: true; status?: number; body: object; session?: SSRSession; endSession?: boolean; csrf?: string }
  /**
   * `endSession` on a REFUSAL is not a contradiction: it is how a flow says "what this browser is holding is
   * dead, stop holding it". Without it the cookies survive the refusal that proved them worthless, and the
   * readable hint — which outlives the access token on purpose, to advertise the renewal window — sends the page
   * back to renew on every single load. One 401 per page view, forever, for a session that ended weeks ago.
   */
  | { ok: false; status: number; body: object; endSession?: boolean };

const refuse = (status: number, error: string, reason?: AuthFailure): AuthOutcome => ({
  ok: false,
  status,
  body: reason ? { error, reason } : { error }
});

const NOT_OFFERED = refuse(404, 'Not found');

/**
 * A field from a request body, as a string. Numbers count: JSON carries an all-digits password as a number, and a
 * client that sends one has supplied a password — refusing it as "credentials are required" is a lie about what
 * arrived. Objects and arrays do not, since `[object Object]` is not a value anybody sent.
 */
const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

const asString = (value: unknown): string => asText(value).trim();

const now = (): number => Math.floor(Date.now() / 1000);

const MINUTE = 60;
const HOUR = 3600;

/**
 * How long the things this server mails or hands out stay good for. Constants rather than configuration: each is a
 * security answer with one sensible value, and an option here is a question every deployment has to work out an
 * answer to before it can start.
 */
const LIFETIME = {
  /** A code from an email. Long enough to go and find it, short enough that a stolen one is worthless. */
  signInCode: 10 * MINUTE,
  /** A reset link IS a password, and it sits in an inbox, a mail archive, a forwarded ticket. */
  resetLink: HOUR,
  /** Confirming an address is not a credential in the same way, and people read their mail tomorrow. */
  confirmLink: 24 * HOUR,
  /** A borrowed session — see `admin.impersonate`. Short, and it cannot renew. */
  impersonation: 15 * MINUTE
};

const STATUSES: AccountStatus[] = ['active', 'inactive', 'blocked'];

/** An account as it may be shown. Never the password hash, and never the credentials — not even to an admin. */
const profileOf = (account: AccountRecord) => ({
  id: account.id,
  username: account.username,
  email: account.email,
  active: account.active,
  verified: account.verified
});

/**
 * The HTTP surface of authentication, as functions rather than routes.
 *
 * Nothing here knows about Express, or about this server's own pipeline: a handler is given what the request
 * carried and answers what should be sent, including whether the session cookies should be written or cleared. The
 * binding does the rest, which is what lets the same login live behind an API endpoint and behind a rendered page's
 * form without either owning it.
 */
export const createAuthApi = ({
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
    adminPermission = 'userManage',
    impersonationPermission,
    password: policy = {},
    rateLimit = createMemoryRateLimit(),
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
      console.error('[auth] security event handler threw:', error);
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
      const report = onMailError ?? ((cause: unknown) => console.error('[auth] could not send mail:', cause));
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
    capabilities,

    /** What a client reads to know which of the flows below actually exist here. */
    describe: (): AuthOutcome => ({ ok: true, body: { features: capabilities } }),

    /**
     * Who the caller is, and until when. Reaching a resolved actor at all is the answer to "is the session alive" —
     * the guard refuses with a `reason` when it could not, so a client learns whether to renew or to drop to
     * signed-out from the refusal itself. It costs no query: the actor was resolved before routing.
     */
    session: (actor?: Actor): AuthOutcome => {
      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const now = Math.floor(Date.now() / 1000);

      return {
        ok: true,
        body: {
          success: true,
          details: {
            id: actor.id,
            username: actor.username,
            email: actor.email,
            verified: actor.verified,
            roles: actor.roles,
            permissions: actor.permissions,
            // Only when somebody is being acted for. A UI that shows whose account this is has to be able to say
            // "you are viewing as", and it can only do that if the session endpoint admits it.
            ...(actor.impersonatedBy === undefined ? {} : { impersonatedBy: actor.impersonatedBy })
          },
          access_token: actor.token,
          expire_in: Math.max(0, actor.expiresAt - now),
          expire_at: actor.expiresAt
        }
      };
    },

    login: async (credentials: Record<string, unknown>, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
      if (!capabilities.passwordLogin) {
        return NOT_OFFERED;
      }

      const username = asString(credentials.username);
      // Not trimmed: whitespace can be part of a password.
      const password = asText(credentials.password);
      if (!username || !password) {
        return refuse(400, 'A username and a password are required');
      }

      const limited = await throttled({ action: 'login', key: username, carrier });
      if (limited) {
        return limited;
      }

      const account = await adapters.findByUsername?.(username);
      if (!account) {
        return refuse(401, 'Invalid credentials');
      }

      if (!account.active) {
        return refuse(401, 'Account is not active');
      }

      // An account created through an identity provider carries no password. Never compare an empty hash: password
      // sign-in stays closed for it until its owner sets one through the reset flow.
      if (!account.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
        record({ type: 'login.failed', userId: account.id, carrier, detail: { username } });

        return refuse(401, 'Invalid credentials');
      }

      /**
       * The password was right. If there is a proven second factor, that buys a CHALLENGE and not a session — an
       * enrolment that was started and never confirmed does not count, or a scan that failed would lock the
       * account out of itself.
       */
      const mfa = capabilities.mfa ? await adapters.loadMfa?.(account.id) : undefined;
      if (mfa?.confirmedAt) {
        record({ type: 'login.mfa-required', userId: account.id, carrier });

        return {
          ok: true,
          body: { success: false, mfaRequired: true, mfaToken: tokens.generateMfaChallenge(account.id) }
        };
      }

      const session = await issue(account.id, { client: clientOf(carrier) });
      throttleSucceeded({ action: 'login', key: username, carrier });
      record({ type: 'login', userId: account.id, carrier });

      return { ok: true, body: await grantBody(account, session), session };
    },

    /**
     * The second half of a sign-in that owed a factor.
     *
     * Takes a TOTP code or a recovery code. A recovery code is SPENT — removed from the stored list — because one
     * that survives being used is a password with extra steps.
     */
    completeMfa: async (mfaToken: string, code: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
      if (!capabilities.mfa) {
        return NOT_OFFERED;
      }

      const verified = tokens.verifyMfaChallenge(mfaToken);
      if (!verified.ok) {
        return refuse(401, authFailureMessage[verified.reason], verified.reason);
      }

      const userId = Number(verified.payload.sub);
      const limited = await throttled({ action: 'mfa', key: String(userId), carrier });
      if (limited) {
        return limited;
      }

      const account = await adapters.findById?.(userId);
      const mfa = await adapters.loadMfa?.(userId);
      if (!account || !mfa?.confirmedAt) {
        return refuse(401, 'Invalid credentials');
      }

      if (!account.active) {
        return refuse(401, 'Account is not active', 'inactive');
      }

      const stored = mfa.recoveryCodes ?? [];
      const supplied = digestRecoveryCode(code);
      const usedRecovery = stored.includes(supplied);

      if (!usedRecovery && !verifyTotp(mfa.secret, code)) {
        record({ type: 'mfa.failed', userId, carrier });

        return refuse(401, 'Invalid code');
      }

      if (usedRecovery) {
        await adapters.saveMfa?.(userId, { ...mfa, recoveryCodes: stored.filter(entry => entry !== supplied) });
      }

      const session = await issue(userId, { client: clientOf(carrier) });
      throttleSucceeded({ action: 'mfa', key: String(userId), carrier });
      record({ type: 'login', userId, carrier, detail: { recoveryCode: usedRecovery } });

      return {
        ok: true,
        body: { ...(await grantBody(account, session)), ...(usedRecovery ? { recoveryCodeUsed: true } : {}) },
        session
      };
    },

    /**
     * Signing in with a code sent to an email address, and no password at all.
     *
     * Two decisions worth stating. **The request answers the same whether the address exists or not** — anything
     * else turns this endpoint into a way to ask which addresses have accounts. And **it never creates an
     * account**: a sign-in flow that silently registers whoever asks is a different feature, and one a deployment
     * should choose deliberately rather than inherit.
     */
    passwordless: {
      request: async (email: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
        if (!capabilities.passwordless) {
          return NOT_OFFERED;
        }

        const address = asString(email).toLowerCase();
        if (!address) {
          return refuse(400, 'An email is required');
        }

        const limited = await throttled({ action: 'passwordless', key: address, carrier });
        if (limited) {
          return limited;
        }

        const account = await adapters.findByEmail?.(address);
        if (account?.active) {
          /**
           * Six characters somebody reads out of an email and types, not a link token — `generateToken` mints 128
           * random bits, which is right for something clicked and hostile for something retyped. Two different jobs
           * that were sharing one function, and the deployment that fixed the code for typing quietly weakened
           * every reset link it mailed.
           */
          const code = randomCode(6);
          await adapters.saveOtp?.({
            purpose: 'signin',
            identifier: address,
            codeHash: digestRecoveryCode(code),
            expiresAt: now() + LIFETIME.signInCode,
            userId: account.id
          });
          await deliver({
            to: account.email,
            template: 'signin-code',
            data: { username: account.username, code }
          });
        }

        // Identical either way, deliberately: see above.
        return { ok: true, body: { message: 'If that address has an account, a sign-in link is on its way' } };
      },

      complete: async (email: string, code: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
        if (!capabilities.passwordless) {
          return NOT_OFFERED;
        }

        const address = asString(email).toLowerCase();
        if (!address || !code) {
          return refuse(400, 'An email and a code are required');
        }

        const limited = await throttled({ action: 'passwordless', key: address, carrier });
        if (limited) {
          return limited;
        }

        const stored = await adapters.findOtp?.('signin', address);
        if (!stored || stored.expiresAt < now() || stored.codeHash !== digestRecoveryCode(code)) {
          record({ type: 'login.failed', carrier, detail: { method: 'passwordless', email: address } });

          return refuse(401, 'Invalid or expired code');
        }

        // Spent before the session is minted: a code that survives being redeemed is a password sent by email.
        await adapters.consumeOtp?.(stored.id);

        const account = stored.userId === undefined ? undefined : await adapters.findById?.(stored.userId);
        if (!account?.active) {
          return refuse(401, 'Account is not active', 'inactive');
        }

        /**
         * A second factor still applies. Arriving by email proves the address, which is one factor — enrolling a
         * second one and then having it skipped by asking for a link would make it decorative.
         */
        const mfa = capabilities.mfa ? await adapters.loadMfa?.(account.id) : undefined;
        if (mfa?.confirmedAt) {
          record({ type: 'login.mfa-required', userId: account.id, carrier });

          return {
            ok: true,
            body: { success: false, mfaRequired: true, mfaToken: tokens.generateMfaChallenge(account.id) }
          };
        }

        const session = await issue(account.id, { client: clientOf(carrier) });
        throttleSucceeded({ action: 'passwordless', key: address, carrier });
        record({ type: 'login', userId: account.id, carrier, detail: { method: 'passwordless' } });

        return { ok: true, body: await grantBody(account, session), session };
      }
    },

    /**
     * Everything about this account's second factor. `begin` hands back a secret and the URI an app scans; nothing
     * is in force until `confirm` proves a code from it.
     */
    mfa: {
      status: async (actor: Actor | undefined): Promise<AuthOutcome> => {
        if (!capabilities.mfa) {
          return NOT_OFFERED;
        }

        if (!actor) {
          return refuse(401, 'Not authenticated', 'missing');
        }

        const mfa = await adapters.loadMfa?.(actor.id);

        return {
          ok: true,
          body: {
            enabled: Boolean(mfa?.confirmedAt),
            pending: Boolean(mfa && !mfa.confirmedAt),
            recoveryCodesRemaining: mfa?.recoveryCodes?.length ?? 0
          }
        };
      },

      begin: async (actor: Actor | undefined): Promise<AuthOutcome> => {
        if (!capabilities.mfa) {
          return NOT_OFFERED;
        }

        if (!actor) {
          return refuse(401, 'Not authenticated', 'missing');
        }

        const existing = await adapters.loadMfa?.(actor.id);
        if (existing?.confirmedAt) {
          return refuse(409, 'A second factor is already set up. Remove it before enrolling another.');
        }

        // A fresh secret every time enrolment restarts: reusing an abandoned one would let a half-finished scan
        // from an old device keep working.
        const secret = generateTotpSecret();
        await adapters.saveMfa?.(actor.id, { secret });

        return {
          ok: true,
          body: {
            secret,
            uri: totpUri({ secret, account: actor.email || actor.username, issuer: mfaIssuer ?? tokens.issuer })
          }
        };
      },

      /** Proves the app was actually set up, and only then does the factor start being required. */
      confirm: async (actor: Actor | undefined, code: string): Promise<AuthOutcome> => {
        if (!capabilities.mfa) {
          return NOT_OFFERED;
        }

        if (!actor) {
          return refuse(401, 'Not authenticated', 'missing');
        }

        const mfa = await adapters.loadMfa?.(actor.id);
        if (!mfa) {
          return refuse(400, 'Start the enrolment first');
        }

        if (mfa.confirmedAt) {
          return refuse(409, 'A second factor is already set up');
        }

        if (!verifyTotp(mfa.secret, code)) {
          record({ type: 'mfa.failed', userId: actor.id });

          return refuse(401, 'Invalid code');
        }

        // Shown once and stored hashed, which is what makes them worth having: a deployment that could print them
        // again is a deployment where reading the database is enough to bypass the second factor.
        const plain = generateRecoveryCodes();
        await adapters.saveMfa?.(actor.id, {
          ...mfa,
          confirmedAt: Math.floor(Date.now() / 1000),
          recoveryCodes: plain.map(digestRecoveryCode)
        });
        record({ type: 'mfa.enabled', userId: actor.id });

        return { ok: true, body: { success: true, recoveryCodes: plain } };
      },

      /** Removing a factor is a security downgrade, so it asks for the password the way deleting an account does. */
      disable: async (actor: Actor | undefined, password?: string): Promise<AuthOutcome> => {
        if (!capabilities.mfa || !adapters.deleteMfa) {
          return NOT_OFFERED;
        }

        if (!actor) {
          return refuse(401, 'Not authenticated', 'missing');
        }

        const account = await adapters.findById?.(actor.id);
        if (account?.passwordHash) {
          if (!password || !(await verifyPassword(password, account.passwordHash))) {
            return refuse(401, 'Invalid credentials');
          }
        }

        await adapters.deleteMfa(actor.id);
        record({ type: 'mfa.disabled', userId: actor.id });

        return { ok: true, body: { success: true } };
      }
    },

    refresh: async (refreshToken?: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
      if (!capabilities.refresh) {
        return NOT_OFFERED;
      }

      if (!refreshToken) {
        return refuse(400, 'Refresh token is required');
      }

      /**
       * Every refusal below ends the session in this browser, because each of them means the credential it just
       * presented can never work again: no such row, past its deadline, or an account that may not hold one. What
       * is being cleared is not authority — the row is already gone — it is the browser's reason to keep asking.
       */
      const account = await adapters.findByRefreshToken?.(refreshToken);
      if (!account || !account.refreshExpiresAt || account.refreshExpiresAt < Math.floor(Date.now() / 1000)) {
        return { ...refuse(401, 'Invalid or expired refresh token', 'expired'), endSession: true };
      }

      if (!account.active) {
        return { ...refuse(401, 'Account is not active', 'inactive'), endSession: true };
      }

      const cap = tokens.lifetimes.session;
      if (cap > 0 && account.sessionStartedAt !== undefined && account.sessionStartedAt + cap < now()) {
        // Ended rather than merely refused, or the row lingers until its refresh token ages out.
        await adapters.clearSession({ refreshToken });

        return { ...refuse(401, 'This session has reached its maximum lifetime', 'expired'), endSession: true };
      }

      const session = await issue(account.id, { replaces: { refreshToken }, client: clientOf(carrier) });

      return { ok: true, body: await grantBody(account, session), session };
    },

    /** Reachable with an expired access token on purpose, or a live refresh token could never be revoked. */
    logout: async (credentials: { accessToken?: string; refreshToken?: string }): Promise<AuthOutcome> => {
      if (credentials.accessToken || credentials.refreshToken) {
        await adapters.clearSession(credentials);
      }

      return { ok: true, body: { message: 'Logged out successfully' }, endSession: true };
    },

    /**
     * Ends this account's session everywhere, for the case where one leaked. Unlike logout it is authenticated and
     * works by account id, so it can be used from a device that still has a good session while the stolen copy is
     * somewhere else entirely.
     */
    revokeSessions: async (userId?: number): Promise<AuthOutcome> => {
      if (!userId) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      await adapters.clearSession({ userId });

      return { ok: true, body: { message: 'All sessions revoked' }, endSession: true };
    },

    exchange: async (provider: string, token: string, carrier: CredentialCarrier): Promise<AuthOutcome> => {
      const result = await exchangeAccount(provider, token, carrier);
      if (!result.ok) {
        return result.offered ? refuse(result.status, result.error, result.reason) : NOT_OFFERED;
      }

      const { account, access, session } = result;

      return { ok: true, body: await grantBody(account, session, access), session };
    },

    /**
     * The same exchange, answering in accounts rather than in HTTP.
     *
     * A page server needs who came back and the session they got; the flow above needs a body and a status. They
     * are the same act, and the translation between them has one correct answer — so it is made once, here, rather
     * than by every deployment that wires an external identity provider into a rendered page.
     */
    exchangeAccount,

    signup: async (fields: Record<string, unknown>): Promise<AuthOutcome> => {
      if (!capabilities.signup) {
        return NOT_OFFERED;
      }

      const username = asString(fields.username);
      const email = asString(fields.email);
      const password = asText(fields.password);
      if (!username || !email || !password) {
        return refuse(400, 'A username, an email and a password are required');
      }

      const weak = await rejectPassword(password, { username, email });
      if (weak) {
        return weak;
      }

      const limited = await throttled({ action: 'signup', key: email });
      if (limited) {
        return limited;
      }

      if ((await adapters.findByUsername?.(username)) ?? (await adapters.findByEmail?.(email))) {
        return refuse(400, 'User already exists');
      }

      // Both are guaranteed by `capabilities.signup`; asserting it here keeps that guarantee where it is decided.
      if (!adapters.createAccount) {
        return NOT_OFFERED;
      }

      const account = await adapters.createAccount({
        username,
        email,
        passwordHash: await hashPassword(password)
      });

      if (!verifyOnSignup && capabilities.emailVerification && adapters.setValidationToken) {
        const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
        await adapters.setValidationToken(account.id, validationToken);
        await deliver({ to: email, template: 'validation', data: { username, validationToken } });
      }

      record({ type: 'signup', userId: account.id });

      return { ok: true, status: 201, body: { message: 'User created successfully', userId: account.id } };
    },

    /** Answers the same either way: whether an address has an account here is not something a stranger may probe. */
    forgotPassword: async (email: string): Promise<AuthOutcome> => {
      if (!capabilities.passwordReset) {
        return NOT_OFFERED;
      }

      // Throttled by address, or this endpoint is a way to send somebody a hundred emails.
      const limited = await throttled({ action: 'forgotPassword', key: asString(email) });
      if (limited) {
        return limited;
      }

      const account = await adapters.findByEmail?.(asString(email));
      if (account) {
        const resetToken = mintLink(generateToken(), LIFETIME.resetLink);
        await adapters.setResetToken?.(account.id, resetToken);
        await deliver({
          to: account.email,
          template: 'password-reset',
          data: { username: account.username, resetToken }
        });
      }

      return { ok: true, body: { message: 'Password reset email sent' } };
    },

    resetPassword: async (token: string, password: string): Promise<AuthOutcome> => {
      if (!capabilities.passwordReset) {
        return NOT_OFFERED;
      }

      if (!token || !password) {
        return refuse(400, 'A token and a password are required');
      }

      // Throttled by token: without it a reset token is guessable by trying, however opaque it is.
      const limited = await throttled({ action: 'resetPassword', key: token });
      if (limited) {
        return limited;
      }

      // The deadline first: an expired token must not be looked up as though it were live, and the answer is the
      // same either way — telling the two apart would say whether the token ever existed.
      const account = linkExpired(token) ? undefined : await adapters.findByResetToken?.(token);
      if (!account) {
        return refuse(400, 'Invalid or expired token');
      }

      const weak = await rejectPassword(password, { username: account.username, email: account.email });
      if (weak) {
        return weak;
      }

      await adapters.setPassword?.(account.id, await hashPassword(password));
      await adapters.setResetToken?.(account.id, '');
      // Whoever forced the reset — or stole the old password — must not keep a working session.
      await adapters.clearSession({ userId: account.id });

      record({ type: 'password.reset', userId: account.id });

      return { ok: true, body: { message: 'Password reset successfully' }, endSession: true };
    },

    validateAccount: async (token: string): Promise<AuthOutcome> => {
      if (!capabilities.emailVerification) {
        return NOT_OFFERED;
      }

      const account = linkExpired(token) ? undefined : await adapters.findByValidationToken?.(token);
      if (!account) {
        return refuse(400, 'Invalid or expired token');
      }

      await adapters.setVerified?.(account.id, true);

      return { ok: true, body: { message: 'Account validated successfully' } };
    },

    resendVerification: async (email: string): Promise<AuthOutcome> => {
      if (!capabilities.emailVerification) {
        return NOT_OFFERED;
      }

      const account = await adapters.findByEmail?.(asString(email));
      if (account && !account.verified) {
        const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
        await adapters.setValidationToken?.(account.id, validationToken);
        await deliver({
          to: account.email,
          template: 'validation',
          data: { username: account.username, validationToken }
        });
      }

      return { ok: true, body: { message: 'Verification email resent' } };
    },

    /**
     * Change what an account says about itself.
     *
     * Both fields are sign-in identifiers, so both are checked for collision first — a store that only has a unique
     * index reports the clash as a driver error five hundred lines away.
     */
    updateProfile: async (actor: Actor | undefined, fields: Record<string, unknown>): Promise<AuthOutcome> => {
      if (!capabilities.profile || !adapters.updateAccount) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const username = asString(fields.username);
      const email = asString(fields.email);
      if (!username && !email) {
        return refuse(400, 'Nothing to change');
      }

      if (username && username !== actor.username) {
        const taken = await adapters.findByUsername?.(username);
        if (taken && taken.id !== actor.id) {
          return refuse(409, 'That username is taken');
        }
      }

      if (email && email !== actor.email) {
        const taken = await adapters.findByEmail?.(email);
        if (taken && taken.id !== actor.id) {
          return refuse(409, 'That email is taken');
        }
      }

      const changingEmail = Boolean(email) && email !== actor.email;

      /**
       * A new address is PARKED, not applied: the account keeps the one it has until the new one answers a
       * confirmation. That is what makes a typo survivable — `n@exmaple.com` costs a resend, not the account.
       *
       * The alternative, applying it and taking `verified` away, was tried and reverted: `verified` in this server
       * gates ACCESS (`createAuthorizer` refuses to present an unverified account as an actor at all), so it locked
       * people out of the account they were sitting in. And the attack it guarded against needs a live session,
       * from which the same person could simply change the password.
       *
       * A deployment that supplies nowhere to park it changes the address on the spot, as it always did.
       */
      const parking = changingEmail && capabilities.emailChange;

      const account = await adapters.updateAccount(actor.id, {
        ...(username ? { username } : {}),
        ...(email && !parking ? { email } : {})
      });

      if (parking && adapters.setPendingEmail) {
        const confirmationToken = mintLink(generateToken(), LIFETIME.confirmLink);
        await adapters.setPendingEmail(actor.id, email, confirmationToken);
        await deliver({
          to: email,
          template: 'email-change',
          data: { username: account.username, email, confirmationToken }
        });

        return {
          ok: true,
          body: {
            success: true,
            details: profileOf(account),
            pendingEmail: email,
            message: 'A confirmation was sent to the new address. It takes effect once confirmed.'
          }
        };
      }

      if (changingEmail && capabilities.emailVerification && adapters.setValidationToken) {
        const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
        await adapters.setValidationToken(actor.id, validationToken);
        await deliver({
          to: account.email,
          template: 'validation',
          data: { username: account.username, validationToken }
        });

        return {
          ok: true,
          body: {
            success: true,
            details: profileOf(account),
            message: 'A confirmation was sent to the new address'
          }
        };
      }

      return { ok: true, body: { success: true, details: profileOf(account) } };
    },

    /**
     * Takes the parked address, having proved somebody reads it.
     *
     * Public, and it has to be: the link is opened from a mail client, in whatever browser that happens to be, with
     * no session. The token is the whole credential — which is why it is single-use and why confirming also marks
     * the account verified: an address that answered a link is an address that was proven.
     */
    confirmEmailChange: async (token: string): Promise<AuthOutcome> => {
      if (!capabilities.emailChange || !adapters.findByPendingEmail || !adapters.clearPendingEmail) {
        return NOT_OFFERED;
      }

      const confirmation = asString(token);
      const pending = linkExpired(confirmation) ? undefined : await adapters.findByPendingEmail(confirmation);
      if (!pending) {
        return refuse(400, 'Invalid or expired token');
      }

      // Between asking and confirming, somebody else may have signed up with it. Sign-in identifiers are unique, so
      // this has to be refused here rather than surfacing as a driver error from the write below.
      const taken = await adapters.findByEmail?.(pending.email);
      if (taken && taken.id !== pending.account.id) {
        await adapters.clearPendingEmail(pending.account.id);

        return refuse(409, 'That email is taken');
      }

      const account = await adapters.updateAccount?.(pending.account.id, { email: pending.email });
      await adapters.clearPendingEmail(pending.account.id);

      if (adapters.setVerified) {
        await adapters.setVerified(pending.account.id, true);
      }

      record({ type: 'email.changed', userId: pending.account.id, detail: { email: pending.email } });

      const confirmed = { ...(account ?? pending.account), email: pending.email };

      return {
        ok: true,
        body: {
          success: true,
          details: profileOf(adapters.setVerified ? { ...confirmed, verified: true } : confirmed)
        }
      };
    },

    /**
     * Change a password, having proved you know the current one.
     *
     * Then **every other session ends**. Changing a password is what somebody does when they think a credential
     * escaped, and one that leaves the other sessions signed in has not done the thing they asked for. The session
     * making the change survives, or the act of securing the account would sign them out of it.
     */
    changePassword: async (
      actor: Actor | undefined,
      currentPassword: string,
      newPassword: string
    ): Promise<AuthOutcome> => {
      if (!capabilities.passwordChange || !adapters.findById) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      if (!currentPassword || !newPassword) {
        return refuse(400, 'The current and the new password are required');
      }

      const weak = await rejectPassword(newPassword, { username: actor.username, email: actor.email });
      if (weak) {
        return weak;
      }

      const limited = await throttled({ action: 'changePassword', key: String(actor.id) });
      if (limited) {
        return limited;
      }

      const account = await adapters.findById(actor.id);
      if (!account?.passwordHash || !(await verifyPassword(currentPassword, account.passwordHash))) {
        return refuse(401, 'Invalid credentials');
      }

      await adapters.setPassword?.(actor.id, await hashPassword(newPassword));
      await adapters.revokeOtherSessions?.(actor.id, actor.token);
      throttleSucceeded({ action: 'changePassword', key: String(actor.id) });
      record({ type: 'password.changed', userId: actor.id });

      return { ok: true, body: { success: true, message: 'Password changed. Other sessions were signed out.' } };
    },

    /**
     * Close the account.
     *
     * Confirmed with the password when there is one — this is irreversible, and a borrowed session should not be
     * able to do it. An account with no password (one that signs in through a provider) cannot be asked, so the
     * session alone has to be enough.
     */
    deleteSelf: async (actor: Actor | undefined, password?: string): Promise<AuthOutcome> => {
      if (!capabilities.accountDeletion || !adapters.deleteAccount) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const account = await adapters.findById?.(actor.id);
      if (account?.passwordHash) {
        if (!password || !(await verifyPassword(password, account.passwordHash))) {
          return refuse(401, 'Invalid credentials');
        }
      }

      await adapters.deleteAccount(actor.id);
      record({ type: 'account.deleted', userId: actor.id });

      return { ok: true, body: { success: true, message: 'Account deleted' }, endSession: true };
    },

    /** The devices this account is signed in on, with the one asking marked. */
    listSessions: async (actor: Actor | undefined): Promise<AuthOutcome> => {
      if (!capabilities.sessionList || !adapters.listSessions) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      return { ok: true, body: { sessions: await adapters.listSessions(actor.id, actor.token) } };
    },

    /** End one of them. Scoped to the caller's own account, or a session id would be an IDOR. */
    revokeSession: async (actor: Actor | undefined, sessionId: number): Promise<AuthOutcome> => {
      if (!adapters.revokeSession) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      if (!Number.isInteger(sessionId)) {
        return refuse(400, 'A session id is required');
      }

      const removed = await adapters.revokeSession(actor.id, sessionId);

      return removed ? { ok: true, body: { success: true } } : refuse(404, 'No such session');
    },

    /** "Sign out everywhere else" — the thing to do from a device you still hold after losing one you do not. */
    revokeOtherSessions: async (actor: Actor | undefined): Promise<AuthOutcome> => {
      if (!adapters.revokeOtherSessions) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      return { ok: true, body: { success: true, revoked: await adapters.revokeOtherSessions(actor.id, actor.token) } };
    },

    admin: {
      list: async (actor: Actor | undefined, query: AccountQuery): Promise<AuthOutcome> => {
        const denial = requireAdmin(actor);
        if (denial) {
          return denial;
        }

        if (!adapters.listAccounts) {
          return NOT_OFFERED;
        }

        const { accounts, total } = await adapters.listAccounts(query);

        return { ok: true, body: { accounts: accounts.map(profileOf), total } };
      },

      get: async (actor: Actor | undefined, userId: number): Promise<AuthOutcome> => {
        const denial = requireAdmin(actor);
        if (denial) {
          return denial;
        }

        const account = await adapters.findById?.(userId);
        if (!account) {
          return refuse(404, 'No such account');
        }

        return { ok: true, body: { account: profileOf(account), access: await adapters.loadAccess(userId) } };
      },

      /**
       * Suspend, block or restore an account — and **end its sessions when it stops being active**.
       *
       * That second half is the whole point. A ban that leaves the credential working is not a ban, it is a note
       * in a database; the person stays signed in until their token happens to lapse.
       */
      setStatus: async (actor: Actor | undefined, userId: number, status: AccountStatus): Promise<AuthOutcome> => {
        const denial = requireAdmin(actor, userId);
        if (denial) {
          return denial;
        }

        if (!adapters.setStatus) {
          return NOT_OFFERED;
        }

        if (!STATUSES.includes(status)) {
          return refuse(400, `Status must be one of ${STATUSES.join(', ')}`);
        }

        if (!(await adapters.findById?.(userId))) {
          return refuse(404, 'No such account');
        }

        await adapters.setStatus(userId, status);

        if (status !== 'active') {
          await adapters.clearSession({ userId });
        }

        record({ type: 'admin.status-changed', userId, actorId: actor?.id, detail: { status } });

        return { ok: true, body: { success: true, status } };
      },

      setRoles: async (actor: Actor | undefined, userId: number, roles: unknown): Promise<AuthOutcome> => {
        const denial = requireAdmin(actor);
        if (denial) {
          return denial;
        }

        if (!adapters.setRoles) {
          return NOT_OFFERED;
        }

        if (!Array.isArray(roles) || roles.some(role => typeof role !== 'string')) {
          return refuse(400, 'Roles must be a list of names');
        }

        const names = roles as string[];

        if (!(await adapters.findById?.(userId))) {
          return refuse(404, 'No such account');
        }

        await adapters.setRoles(userId, names);
        record({ type: 'admin.roles-changed', userId, actorId: actor?.id, detail: { roles: names } });

        return { ok: true, body: { success: true, roles: names } };
      },

      remove: async (actor: Actor | undefined, userId: number): Promise<AuthOutcome> => {
        const denial = requireAdmin(actor, userId);
        if (denial) {
          return denial;
        }

        if (!adapters.deleteAccount) {
          return NOT_OFFERED;
        }

        if (!(await adapters.findById?.(userId))) {
          return refuse(404, 'No such account');
        }

        await adapters.deleteAccount(userId);
        record({ type: 'admin.account-deleted', userId, actorId: actor?.id });

        return { ok: true, body: { success: true } };
      },

      /**
       * A session AS somebody else, for support that has to see what they see.
       *
       * Three properties make it something a deployment can live with, and all three are deliberate:
       *
       * - **It says so.** The credential carries `act` (RFC 8693), so every request made with it can be told from
       *   one the account holder made — `Actor.impersonatedBy` is that claim, read back. A borrowed session that
       *   is indistinguishable from a real one turns an audit log into fiction.
       * - **It is short and cannot renew.** Fifteen minutes by default and no refresh token, so it expires rather
       *   than becoming a permanent second key to somebody's account.
       * - **It is off unless asked for**, behind its own permission — see `impersonationPermission`.
       *
       * The session is answered in the BODY and no cookie is written. Swapping the administrator's own session
       * cookie for this one would sign them out of the account they administer from, and getting back would mean
       * signing in again; whoever asked decides where to put a credential they were handed.
       *
       * One caveat a deployment has to know: a store that keeps a single session per account — no `session` table —
       * will overwrite the subject's own session with this one, signing them out. Anything with per-session rows,
       * which is what `createMysqlStore` builds, does not.
       */
      impersonate: async (
        actor: Actor | undefined,
        userId: number,
        carrier?: CredentialCarrier
      ): Promise<AuthOutcome> => {
        if (!capabilities.impersonation || !impersonationPermission || !adapters.findById) {
          return NOT_OFFERED;
        }

        const check = checkPermission(actor, impersonationPermission);
        if (!check.ok) {
          return refuse(check.status, check.error, check.status === 401 ? 'missing' : undefined);
        }

        if (!actor || userId === actor.id) {
          return refuse(400, 'You are already signed in as yourself');
        }

        const account = await adapters.findById(userId);
        if (!account) {
          return refuse(404, 'No such account');
        }

        // A suspended account cannot hold a session, and an administrator borrowing one would be the way around
        // that — which is exactly what a ban is for.
        if (!account.active) {
          return refuse(403, 'That account is not active');
        }

        const session = await issue(
          userId,
          { client: clientOf(carrier) },
          { actingAs: actor.id, ttlSeconds: LIFETIME.impersonation, renewable: false }
        );

        record({ type: 'admin.impersonated', userId, actorId: actor.id });

        return { ok: true, body: { ...(await grantBody(account, session)), impersonatedBy: actor.id } };
      }
    },

    /**
     * A CSRF token for whoever is asking, bound to their session when they have one. Answered as a body AND as the
     * cookie the binding writes, so a page can take whichever it finds easier to read.
     */
    issueCsrf: (sessionToken?: string): AuthOutcome => {
      if (!csrf) {
        return NOT_OFFERED;
      }

      const token = csrf.issue(sessionToken);

      return { ok: true, body: { token, headerName: csrf.headerName }, csrf: token };
    },

    /** Exposed so a deployment can mint a session outside the flows above — a rendered page's login form. */
    issueSession: issue,
    resolveActor: identity.resolveActor
  };
};

export type AuthApi = ReturnType<typeof createAuthApi>;
