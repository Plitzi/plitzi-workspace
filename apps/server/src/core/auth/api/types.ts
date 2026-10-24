import type { CredentialCarrier } from '../credentials';
import type { Csrf } from '../csrf';
import type { AuthFailure } from '../tokens';
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
  /**
   * Unix seconds the refresh credential being renewed dies at, reported by `findByRefreshToken` — an override: left
   * out, the credential's own expiry decides.
   */
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
  /**
   * The host it was signed in on: a space's own (`encore.plitzi.app`), where its visitors sign in through the platform,
   * or the platform's. What "sign out of this site everywhere" ends — a host's cookies are its own, so its sessions
   * are what a visitor holds there, on every device.
   */
  host?: string;
  /**
   * The application holding it, when it is not a browser: a native client names itself when it registers
   * (`Plitzi CLI on carlos-mbp`, software `plitzi-cli`). A user agent says which browser; this says which app.
   */
  app?: SessionApp;
}

export interface SessionApp {
  name: string;
  /** A stable name for the software, the same on every machine — what a list picks an icon by. */
  softwareId?: string;
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
  app?: SessionApp;
  /** Where it was signed in (`SessionClient.host`): a space's own host, or the platform's. */
  host?: string;
  createdAt: number;
  /** When it was last used, where the store keeps it; a session never seen since it was made has none. */
  lastActiveAt?: number;
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
  /**
   * The time step of the last code that was accepted. A code of that step or an earlier one is refused: a code is valid
   * for its whole window, and one watched over a shoulder or lifted from a phishing page would otherwise sign a second
   * person in within that window (RFC 6238 §5.2).
   */
  lastUsedStep?: number;
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

/**
 * The user agent and the address, off whatever carried the request — what lets somebody tell their devices apart.
 * Nothing else here reads headers, so it is done once. The address is the host's when it resolved one, the proxies'
 * otherwise; it names a session in a list and decides nothing.
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
  /**
   * Clear the pair, by whichever half the caller holds, or by account — and with `host` beside `userId`, only that
   * account's sessions signed in on that host (`SessionClient.host`): a site's sign-out everywhere, not the account's.
   */
  clearSession: (target: {
    accessToken?: string;
    refreshToken?: string;
    userId?: number;
    host?: string;
  }) => Promise<void>;
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
  /**
   * What would be lost if this account were deleted now, in sentences its owner can act on — "“Studio” has 3 spaces;
   * delete them or make somebody else an owner". Any at all and the deletion is refused, with the list.
   *
   * The account is what holds things a deployment cannot simply drop: a workspace nobody else owns, the spaces in it,
   * a plan still being paid for. Deleting it anyway leaves them orphaned — unreachable by anyone, and possibly still
   * billed. Optional, for a deployment whose accounts own nothing.
   */
  deletionBlockers?: (userId: number) => Promise<string[]>;
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
  /** Where a failed delivery is reported. Defaults to the server log at `error`; it is never thrown — see `deliver`. */
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
