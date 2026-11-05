import type { AccountAccess, AccountRecord, SecurityEvent } from '@plitzi/sdk-kernel/identity';
import type { CredentialCarrier } from '@plitzi/sdk-kernel/identity';
import type { Csrf } from '@plitzi/sdk-kernel/identity';
import type { AuthFailure } from '@plitzi/sdk-kernel/identity';
import type { SSRSession } from '@plitzi/sdk-kernel/types';

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
   * The terms an account is opened under. Set, `/auth/signup` refuses a sign-up that does not say `acceptedTerms: true`
   * (400, `field: 'acceptedTerms'`), and `createAccount` is told which version was accepted and when — the record a
   * deployment keeps of what each person agreed to. `version` is the deployment's own name for the text in force (a
   * date, a number); change it when the terms change.
   */
  terms?: { version: string };
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
