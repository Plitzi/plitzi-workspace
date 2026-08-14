/**
 * The rate limit a deployment gets without asking for one.
 *
 * This used to be a required-to-be-safe option: no `rateLimit`, no limit, and sign-in was an unmetered password
 * oracle. Nobody sets an option they have not read about, so the effect of "there is no sensible default" was that
 * the common deployment shipped without any — which is not a neutral outcome, it is the bad one.
 *
 * It counts in memory, and that is an honest limitation rather than a hidden one: several processes each keep
 * their own window, so a four-process cluster tolerates four times the attempts. Four times a small number is
 * still a small number, and it beats infinity. A deployment that wants one counter for the fleet supplies
 * `rateLimit` and puts it in Redis.
 */

import type { ThrottleAttempt, ThrottledAction } from './api';

/** Attempts allowed per window, per key, per action. */
const LIMITS: Record<ThrottledAction, { attempts: number; windowSeconds: number }> = {
  /** Credential stuffing is the thing being priced out. Ten wrong passwords in five minutes is already a lot. */
  login: { attempts: 10, windowSeconds: 300 },
  signup: { attempts: 5, windowSeconds: 3600 },
  /** Mailing flows are throttled by address, or the endpoint is a way to send somebody a hundred emails. */
  forgotPassword: { attempts: 5, windowSeconds: 3600 },
  /** By token: without this a reset token is guessable by trying, however opaque it is. */
  resetPassword: { attempts: 10, windowSeconds: 3600 },
  changePassword: { attempts: 10, windowSeconds: 300 },
  exchange: { attempts: 30, windowSeconds: 300 },
  /** Six digits is a million guesses, so the limit is what makes a second factor worth anything. */
  mfa: { attempts: 5, windowSeconds: 300 },
  passwordless: { attempts: 5, windowSeconds: 900 }
};

/** Stop the map growing without bound on a server nobody is attacking politely. */
const SWEEP_EVERY = 1000;

export const createMemoryRateLimit = (): ((attempt: ThrottleAttempt) => Promise<{
  allowed: boolean;
  retryAfter?: number;
}>) => {
  const hits = new Map<string, number[]>();
  let sinceSweep = 0;

  const sweep = (now: number): void => {
    for (const [key, times] of hits) {
      const action = key.slice(0, key.indexOf(':')) as ThrottledAction;
      const live = times.filter(at => at > now - LIMITS[action].windowSeconds);

      if (live.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, live);
      }
    }
  };

  return (attempt: ThrottleAttempt) => {
    const { attempts, windowSeconds } = LIMITS[attempt.action];
    const now = Math.floor(Date.now() / 1000);
    const key = `${attempt.action}:${attempt.key}`;

    /**
     * It worked, so nothing is being guarded against any more. Without this the counter cannot tell ten failures
     * from ten sign-ins — the check runs before the password is examined — and an app that signs the same account
     * in repeatedly would lock it out by succeeding.
     */
    if (attempt.succeeded) {
      hits.delete(key);

      return Promise.resolve({ allowed: true });
    }

    if (++sinceSweep >= SWEEP_EVERY) {
      sinceSweep = 0;
      sweep(now);
    }

    const recent = (hits.get(key) ?? []).filter(at => at > now - windowSeconds);
    if (recent.length >= attempts) {
      // When the oldest attempt in the window ages out, which is when there is room for one more.
      return Promise.resolve({ allowed: false, retryAfter: Math.max(1, recent[0] + windowSeconds - now) });
    }

    hits.set(key, [...recent, now]);

    return Promise.resolve({ allowed: true });
  };
};
