import type { AuthFailureReason } from '../types';

export type AuthFailureSignal = {
  reason: AuthFailureReason;
  /** The request that was refused. Auth listens only to refusals from its own backend — see `sameRegistrableDomain`. */
  url?: string;
  /**
   * The credential the refused request carried, when the reporter knows it. A refusal of one the session has already
   * replaced says nothing about the session: it is answered by the renewal that replaced it, never by another — each
   * renewal rotates the token, so renewing again for every request still in flight with the old one refused their
   * retries in turn.
   */
  credential?: string;
};

/** Hears a refusal, and answers whether it renewed the session because of it — or nothing, for a listener that did not. */
export type AuthFailureListener = (signal: AuthFailureSignal) => Promise<boolean> | boolean | undefined;

/**
 * Bumped when a signal or a listener's answer changes shape in a way an older copy could not read: copies on either
 * side of the bump then keep listeners of their own rather than handing each other what they would misread.
 */
const CHANNEL_VERSION = 1;

const LISTENERS = Symbol.for(`plitzi.authFailureListeners.v${String(CHANNEL_VERSION)}`);

/**
 * The listeners every copy of this module on a page shares. One page holds more than one: the builder carries its own
 * `sdk-shared` beside the SDK's, and a module-level set made the builder's refusals reach no one — the SDK's auth
 * listened on its copy, the builder reported on its own, nothing renewed, and every refused request was an
 * "Authentication required" toast over a session a renewal would have kept.
 *
 * What another copy left under the key is checked rather than trusted: anything but a set is said, and this copy keeps
 * listeners of its own — its refusals then reach only its own auth, which the message names.
 */
const listenersOf = (scope: typeof globalThis & { [LISTENERS]?: unknown }): Set<AuthFailureListener> => {
  const found = scope[LISTENERS];
  if (found === undefined) {
    const created = new Set<AuthFailureListener>();
    scope[LISTENERS] = created;

    return created;
  }

  if (found instanceof Set) {
    // Only this module writes the key, versioned by the shape of what it holds: a set under it is a set of listeners.
    return found as Set<AuthFailureListener>;
  }

  console.error(
    `[auth] ${LISTENERS.toString()} holds ${typeof found}, not the set of listeners every copy of @plitzi/sdk-shared ` +
      'shares: this copy keeps its own, so a refusal it reports reaches only the auth of this copy. Something else ' +
      'wrote that key, or a copy changed its shape without bumping CHANNEL_VERSION.'
  );

  return new Set();
};

const listeners = listenersOf(globalThis);

let unheardSaid = false;

/**
 * Says that a backend refused a credential. A session can end between two checks — revoked from another device, an
 * account deactivated — and the first thing that notices is whatever request got refused, not a timer. Reporting it
 * here is how the network layers tell auth that reality moved on, without either knowing about the other.
 *
 * Answers whether the session was renewed because of it: a refusal that only meant "this credential expired" — a tab
 * coming back after its token's life — is answered by a renewal, and the request that was refused can be asked again,
 * once, instead of leaving its section in an error a reload would have cleared. A refused request never ran, so asking
 * it again repeats nothing.
 *
 * Never silent: a refusal no listener hears is said once on the page — what hid the builder's own copy of this channel
 * — and a listener that fails is said and counted as not renewing, never a rejection the caller (often `void`) loses.
 */
export const reportAuthFailure = async (signal: AuthFailureSignal): Promise<boolean> => {
  if (listeners.size === 0) {
    if (!unheardSaid && typeof window !== 'undefined') {
      unheardSaid = true;
      console.warn(
        `[auth] A refused credential (${signal.reason}${signal.url ? `, ${signal.url}` : ''}) was reported, but nothing ` +
          'on this page listens for it, so the session is not renewed. Said once; every later refusal is answered as ' +
          'it was.'
      );
    }

    return false;
  }

  const answers = await Promise.allSettled([...listeners].map(async listener => listener(signal)));

  return answers.some(answer => {
    if (answer.status === 'rejected') {
      console.error('[auth] A listener failed on a refused credential; it is counted as not renewing:', answer.reason);

      return false;
    }

    return answer.value === true;
  });
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
  'sso-required',
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
