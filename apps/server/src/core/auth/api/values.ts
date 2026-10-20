import { forwardedIp } from '../../requestParser';

import type { CredentialCarrier } from '../credentials';
import type { AuthFailure } from '../tokens';
import type { AccountRecord, SessionClient, AccountStatus, AuthOutcome } from './types';

export const clientOf = (carrier?: CredentialCarrier): SessionClient | undefined => {
  if (!carrier) {
    return undefined;
  }

  const userAgent = carrier.headers['user-agent'];
  const ip = carrier.ip || forwardedIp(carrier.headers);
  const client: SessionClient = {
    ...(typeof userAgent === 'string' && userAgent ? { userAgent } : {}),
    ...(ip ? { ip } : {})
  };

  return client.userAgent || client.ip ? client : undefined;
};

/**
 * The account store, as auth needs to see it. Every method is optional except the three the session cycle cannot do
 * without, and **what is absent decides what this server offers**: a deployment with no `createAccount` has no
 * signup, and its route answers 404 rather than failing at runtime. That rule is what lets one server serve a
 * deployment with its own user table and one that signs everybody in through an external provider.
 */

export const refuse = (status: number, error: string, reason?: AuthFailure): AuthOutcome => ({
  ok: false,
  status,
  body: reason ? { error, reason } : { error }
});

export const NOT_OFFERED = refuse(404, 'Not found');

/**
 * A field from a request body, as a string. Numbers count: JSON carries an all-digits password as a number, and a
 * client that sends one has supplied a password — refusing it as "credentials are required" is a lie about what
 * arrived. Objects and arrays do not, since `[object Object]` is not a value anybody sent.
 */
export const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

export const asString = (value: unknown): string => asText(value).trim();

/**
 * The destination a caller named, for a mail to carry — or nothing at all.
 *
 * Carried, not judged: the kernel has no redirect policy, and the link it ends up in is composed by the deployment,
 * which vets it there (`createRedirectPolicy`). Absent rather than empty when there is none, so a mail template never
 * has to know that `''` means "nowhere".
 */
export const destinationOf = (value: unknown): { redirect?: string } => {
  const redirect = asString(value);

  return redirect ? { redirect } : {};
};

export const now = (): number => Math.floor(Date.now() / 1000);

export const MINUTE = 60;
export const HOUR = 3600;

/**
 * How long the things this server mails or hands out stay good for. Constants rather than configuration: each is a
 * security answer with one sensible value, and an option here is a question every deployment has to work out an
 * answer to before it can start.
 */
export const LIFETIME = {
  /** A code from an email. Long enough to go and find it, short enough that a stolen one is worthless. */
  signInCode: 10 * MINUTE,
  /** A reset link IS a password, and it sits in an inbox, a mail archive, a forwarded ticket. */
  resetLink: HOUR,
  /** Confirming an address is not a credential in the same way, and people read their mail tomorrow. */
  confirmLink: 24 * HOUR,
  /** A borrowed session — see `admin.impersonate`. Short, and it cannot renew. */
  impersonation: 15 * MINUTE
};

export const STATUSES: AccountStatus[] = ['active', 'inactive', 'blocked'];

/**
 * Why an account may not hold a session, when it may not.
 *
 * `active` answers whether it may sign in at all; `verified` answers whether its owner can do anything about that.
 * A deployment where confirming an address is what makes an account active — Plitzi is one — refuses both through
 * the same flag, so a screen told only `inactive` has to tell somebody whose address has simply never answered that
 * their password was wrong. It was, in fact, right.
 */
export const deniedReason = (account?: { verified: boolean }): AuthFailure =>
  account && !account.verified ? 'unverified' : 'inactive';

/** An account as it may be shown. Never the password hash, and never the credentials — not even to an admin. */
export const profileOf = (account: AccountRecord) => ({
  id: account.id,
  username: account.username,
  email: account.email,
  active: account.active,
  verified: account.verified
});
