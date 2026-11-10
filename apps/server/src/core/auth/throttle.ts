/**
 * The rate limit a deployment gets without asking for one.
 *
 * This used to be a required-to-be-safe option: no `rateLimit`, no limit, and sign-in was an unmetered password
 * oracle. Nobody sets an option they have not read about, so the effect of "there is no sensible default" was that
 * the common deployment shipped without any — which is not a neutral outcome, it is the bad one.
 *
 * It counts in memory by default, and that is an honest limitation rather than a hidden one: several replicas each
 * keep their own window, so four replicas tolerate four times the attempts. Four times a small number is still a small
 * number, and it beats infinity. A deployment of several replicas passes `rateLimit: createRateLimit({ counts:
 * redisThrottleCounts(redis) })`: one count for all of them. The workers of one server are one replica: they count in
 * the primary (`fleetRateLimit`).
 */

import { randomUUID } from 'node:crypto';

import { fleetStore } from '@plitzi/sdk-kernel/http';

import { addressOf } from './api/values';

import type { ThrottleAttempt, ThrottledAction } from './api';
import type { StoreMethods } from '@plitzi/sdk-kernel/http';

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

/**
 * Signing in is counted three ways when the address is known, so a stranger who knows a username cannot keep its owner
 * out, and one password tried over many usernames is still slowed:
 *
 * - **the account from one address** — `LIMITS.login`: the failures that address made on it, and only it is refused;
 * - **one address over any accounts** — a password sprayed over usernames;
 * - **the account from anywhere** — a ceiling well above the first: an address read from `X-Forwarded-For` can be
 *   spelled by the client, and rotating it must not buy unlimited guesses on one account.
 *
 * With no address, the account alone, at `LIMITS.login` — what it always was.
 */
const LOGIN_FROM_ADDRESS = { attempts: 30, windowSeconds: 300 };
const LOGIN_ACCOUNT_CEILING = { attempts: 100, windowSeconds: 300 };

/** Stop the map growing without bound on a server nobody is attacking politely. */
const SWEEP_EVERY = 1000;

/** An attempt as the count reads it: the address resolved before it crosses to a fleet's primary (`fleetRateLimit`). */
export type CountedAttempt = Omit<ThrottleAttempt, 'carrier'> & {
  carrier?: ThrottleAttempt['carrier'];
  address?: string;
};

/**
 * One count an attempt is held to: its key, the attempts its window holds, and the window. `spray` marks the address's
 * count over any accounts, which a success gives back one attempt of rather than forgetting.
 */
export type ThrottleCounter = { key: string; attempts: number; windowSeconds: number; spray?: boolean };

export type ThrottleVerdict = { allowed: boolean; retryAfter?: number };

/**
 * Where attempts are counted: this process's memory by default ({@link memoryThrottleCounts}), or a store the replicas
 * share ({@link redisThrottleCounts}), so the eleventh failure is refused by whichever replica it reaches.
 *
 * `attempt` is ONE operation over every counter it is handed: each window read and, when none is full, the attempt
 * recorded on all of them — atomically. A store that read and then wrote let a hundred attempts sent at once all read
 * an empty window and all be let through.
 */
export type ThrottleCounts = {
  /** Refused, with when to come back, when any counter's window is full; else recorded on every one, at `now` (s). */
  attempt: (counters: ThrottleCounter[], now: number) => Promise<ThrottleVerdict>;
  /** It worked: each counter forgotten — a `spray` one gives back its latest attempt alone. */
  succeeded: (counters: ThrottleCounter[]) => Promise<void>;
};

const countersOf = (attempt: CountedAttempt): ThrottleCounter[] => {
  const address = attempt.address ?? addressOf(attempt.carrier);
  if (attempt.action !== 'login' || !address) {
    return [{ key: `${attempt.action}:${attempt.key}`, ...LIMITS[attempt.action] }];
  }

  return [
    { key: `login:${attempt.key}@${address}`, ...LIMITS.login },
    { key: `login@${address}`, ...LOGIN_FROM_ADDRESS, spray: true },
    { key: `login:${attempt.key}`, ...LOGIN_ACCOUNT_CEILING }
  ];
};

/** The counts in this process's memory: one replica's, or a fleet's primary's (`fleetRateLimit`). */
export const memoryThrottleCounts = (): ThrottleCounts => {
  const hits = new Map<string, { windowSeconds: number; times: number[] }>();
  let sinceSweep = 0;

  const sweep = (now: number): void => {
    for (const [key, { windowSeconds, times }] of hits) {
      const live = times.filter(at => at > now - windowSeconds);
      if (live.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, { windowSeconds, times: live });
      }
    }
  };

  return {
    attempt: (counters, now) => {
      if (++sinceSweep >= SWEEP_EVERY) {
        sinceSweep = 0;
        sweep(now);
      }

      const recent = counters.map(counter => ({
        counter,
        times: (hits.get(counter.key)?.times ?? []).filter(at => at > now - counter.windowSeconds)
      }));
      const full = recent.filter(({ counter, times }) => times.length >= counter.attempts);
      if (full.length > 0) {
        // When the oldest attempt in the fullest window ages out, which is when there is room for one more.
        const retryAfter = Math.max(
          ...full.map(({ counter, times }) => Math.max(1, times[0] + counter.windowSeconds - now))
        );

        return Promise.resolve({ allowed: false, retryAfter });
      }

      recent.forEach(({ counter, times }) => {
        hits.set(counter.key, { windowSeconds: counter.windowSeconds, times: [...times, now] });
      });

      return Promise.resolve({ allowed: true });
    },
    succeeded: counters => {
      for (const counter of counters) {
        if (counter.spray) {
          hits.get(counter.key)?.times.pop();
        } else {
          hits.delete(counter.key);
        }
      }

      return Promise.resolve();
    }
  };
};

/** What {@link redisThrottleCounts} asks of a Redis client: `EVAL`, as ioredis spells it. */
export type ThrottleRedis = {
  eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
};

/**
 * Every window read and, none full, the attempt added to each — in one script, so no other replica's attempt lands
 * between the read and the write. A window is a sorted set of the attempts' seconds; its key expires with its window.
 * `ARGV`: now, a member unique to this attempt, then each counter's attempts and window.
 */
const ATTEMPT_SCRIPT = `
local now = tonumber(ARGV[1])
local retry = 0
for i = 1, #KEYS do
  local attempts = tonumber(ARGV[1 + i * 2])
  local window = tonumber(ARGV[2 + i * 2])
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now - window)
  if redis.call('ZCARD', KEYS[i]) >= attempts then
    local oldest = redis.call('ZRANGE', KEYS[i], 0, 0, 'WITHSCORES')
    retry = math.max(retry, 1, tonumber(oldest[2]) + window - now)
  end
end
if retry > 0 then
  return retry
end
for i = 1, #KEYS do
  redis.call('ZADD', KEYS[i], now, ARGV[2])
  redis.call('EXPIRE', KEYS[i], tonumber(ARGV[2 + i * 2]))
end
return 0`;

/** Each counter forgotten, or — `ARGV[i]` is `1` — its latest attempt given back. */
const SUCCEEDED_SCRIPT = `
for i = 1, #KEYS do
  if ARGV[i] == '1' then
    redis.call('ZPOPMAX', KEYS[i])
  else
    redis.call('DEL', KEYS[i])
  end
end
return 0`;

/**
 * The counts in a Redis every replica reaches, so the replicas hold one count between them. `prefix` names the keys —
 * keep a `{hash tag}` in it on a Redis Cluster: a script's keys must share a slot.
 */
export const redisThrottleCounts = (
  redis: ThrottleRedis,
  { prefix = '{auth-throttle}:' }: { prefix?: string } = {}
): ThrottleCounts => ({
  attempt: async (counters, now) => {
    const waitSeconds = Number(
      await redis.eval(
        ATTEMPT_SCRIPT,
        counters.length,
        ...counters.map(counter => `${prefix}${counter.key}`),
        now,
        `${String(now)}:${randomUUID()}`,
        ...counters.flatMap(counter => [counter.attempts, counter.windowSeconds])
      )
    );

    return waitSeconds > 0 ? { allowed: false, retryAfter: waitSeconds } : { allowed: true };
  },
  succeeded: async counters => {
    await redis.eval(
      SUCCEEDED_SCRIPT,
      counters.length,
      ...counters.map(counter => `${prefix}${counter.key}`),
      ...counters.map(counter => (counter.spray ? '1' : '0'))
    );
  }
});

/**
 * The rate limit a deployment gets: the policy — which counts an attempt is held to, and what a success gives back —
 * over a store of counts, this process's memory unless it is handed one the replicas share.
 */
export const createRateLimit =
  ({
    counts = memoryThrottleCounts(),
    now = () => Date.now()
  }: { counts?: ThrottleCounts; now?: () => number } = {}): ((attempt: CountedAttempt) => Promise<ThrottleVerdict>) =>
  async attempt => {
    const counters = countersOf(attempt);

    /**
     * It worked, so nothing is being guarded against any more. Without this the counter cannot tell ten failures
     * from ten sign-ins — the check runs before the password is examined — and an app that signs the same account
     * in repeatedly would lock it out by succeeding. The address's own count keeps its other accounts' failures: it
     * gives back only the attempt that worked.
     */
    if (attempt.succeeded) {
      await counts.succeeded(counters);

      return { allowed: true };
    }

    return counts.attempt(counters, Math.floor(now() / 1000));
  };

type RateLimitStore = { check: ReturnType<typeof createRateLimit> };

/** Every method of the store, for the copy a fleet's workers share (`FleetStores`, `core/server/fleet/link.ts`). */
export const RATE_LIMIT_METHODS: StoreMethods<RateLimitStore> = { check: true };

/**
 * In a worker of a fleet, the primary's {@link createRateLimit} in memory, so an attacker spreading attempts over
 * connections meets one counter rather than one per worker. Nothing anywhere else.
 */
export const fleetRateLimit = ():
  ((attempt: ThrottleAttempt) => Promise<{ allowed: boolean; retryAfter?: number }>) | undefined => {
  const shared = fleetStore<RateLimitStore>('auth.rateLimit', RATE_LIMIT_METHODS);
  if (!shared) {
    return undefined;
  }

  // Only what the count reads crosses to the primary — the address resolved here: the carrier holds the request,
  // which cannot be cloned.
  return attempt => {
    const address = addressOf(attempt.carrier);

    return shared.check({
      action: attempt.action,
      key: attempt.key,
      ...(address ? { address } : {}),
      ...(attempt.succeeded ? { succeeded: true } : {})
    });
  };
};
