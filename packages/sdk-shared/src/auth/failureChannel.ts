import type { AuthFailureReason } from '../types';

export type AuthFailureSignal = {
  reason: AuthFailureReason;
  /** The request that was refused. Auth listens only to refusals from its own backend — see `sameRegistrableDomain`. */
  url?: string;
};

export type AuthFailureListener = (signal: AuthFailureSignal) => void;

const listeners = new Set<AuthFailureListener>();

/**
 * Says that a backend refused a credential. A session can end between two checks — revoked from another device, an
 * account deactivated — and the first thing that notices is whatever request got refused, not a timer. Reporting it
 * here is how the network layers tell auth that reality moved on, without either knowing about the other.
 */
export const reportAuthFailure = (signal: AuthFailureSignal): void => {
  for (const listener of listeners) {
    listener(signal);
  }
};

export const onAuthFailure = (listener: AuthFailureListener): (() => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

const REASONS: AuthFailureReason[] = [
  'missing',
  'expired',
  'revoked',
  'inactive',
  'unverified',
  'malformed',
  'outdated',
  'network'
];

/**
 * What an HTTP refusal means for the session. Stated once, because the provider and the network layers must not
 * disagree about which refusals are renewable.
 *
 * Only a 401 is about the session. A backend that names the reason (Plitzi's API answers `reason` on every 401) is
 * believed; one that says nothing gets the benefit of the doubt — an unexplained 401 is treated as renewable, so a
 * stale access token costs one refused renewal instead of signing out a session that was still good.
 *
 * A 403 is never about the session, whatever it carries. It is "you may not do THIS": a permission the account does
 * not hold, or a CSRF check that failed — and the kernel's CSRF refusal names reasons (`missing`, `expired`) that are
 * spelled like session ones. It used to be read as `inactive`, so any screen that asked for something its visitor may
 * not have signed that visitor out on the spot, with nothing on the page to say why. An account that really was
 * deactivated is refused with a 401 naming `inactive`, which is still believed.
 */
export const authFailureFromResponse = (status: number, body?: unknown): AuthFailureReason | undefined => {
  if (status !== 401) {
    return undefined;
  }

  const reason = (body as { reason?: unknown } | undefined)?.reason;
  if (typeof reason === 'string' && REASONS.includes(reason as AuthFailureReason)) {
    return reason as AuthFailureReason;
  }

  return 'expired';
};

const registrableDomain = (host: string): string => /([^.]+\.[^.]+)$/.exec(host)?.[1] ?? host;

/**
 * Whether two URLs belong to the same site, by registrable domain rather than exact origin: a deployment spreads one
 * auth universe over several hosts (`api.example.com`, `server.example.com`), and a refusal from any of them is about
 * the same session. Across sites it is the opposite — a space that authenticates against its owner's backend must not
 * lose its session because Plitzi's API refused something.
 */
export const sameRegistrableDomain = (a?: string, b?: string): boolean => {
  if (!a || !b) {
    return false;
  }

  try {
    const base = typeof window === 'undefined' ? undefined : window.location.href;

    return registrableDomain(new URL(a, base).hostname) === registrableDomain(new URL(b, base).hostname);
  } catch {
    return false;
  }
};
