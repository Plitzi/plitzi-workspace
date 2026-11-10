import { describe, expect, it, vi } from 'vitest';

import { createRateLimit } from './throttle';

/**
 * The limit a deployment gets for free. What matters is not the numbers — those are a judgement — but that it is
 * there at all: this used to be an option with no default, which meant the ordinary deployment shipped an
 * unmetered password endpoint because nobody configures what they have not read about.
 */

const attempts = async (limit: ReturnType<typeof createRateLimit>, count: number, key = 'ada') => {
  const verdicts = [];
  for (let i = 0; i < count; i++) {
    verdicts.push(await limit({ action: 'login', key }));
  }

  return verdicts;
};

describe('the built-in rate limit', () => {
  it('lets a normal number of attempts through and then stops', async () => {
    const verdicts = await attempts(createRateLimit(), 12);

    expect(verdicts.slice(0, 10).every(verdict => verdict.allowed)).toBe(true);
    expect(verdicts[10]).toMatchObject({ allowed: false });
    expect(verdicts[11]).toMatchObject({ allowed: false });
  });

  /** So a client knows to come back rather than hammering, and so a UI can say how long. */
  it('says when to try again', async () => {
    const verdicts = await attempts(createRateLimit(), 11);
    const refused = verdicts[10] as { retryAfter?: number };

    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(300);
  });

  it('counts each account separately, so one person cannot lock another out', async () => {
    const limit = createRateLimit();
    await attempts(limit, 11, 'ada');

    expect(await limit({ action: 'login', key: 'grace' })).toMatchObject({ allowed: true });
  });

  it('counts each kind of attempt separately', async () => {
    const limit = createRateLimit();
    await attempts(limit, 11, 'ada');

    expect(await limit({ action: 'forgotPassword', key: 'ada' })).toMatchObject({ allowed: true });
  });

  /** A sliding window: somebody who was locked out gets back in, without anybody having to clear anything. */
  it('forgives once the window has passed', async () => {
    const limit = createRateLimit();
    await attempts(limit, 11);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);

    expect(await limit({ action: 'login', key: 'ada' })).toMatchObject({ allowed: true });

    vi.useRealTimers();
  });

  /** Six digits is a million guesses; the limit is what makes a second factor worth having. */
  it('is tightest where the secret is shortest', async () => {
    const limit = createRateLimit();
    const verdicts = [];
    for (let i = 0; i < 6; i++) {
      verdicts.push(await limit({ action: 'mfa', key: '7' }));
    }

    expect(verdicts[5]).toMatchObject({ allowed: false });
  });
});

describe('a success', () => {
  /** Ten sign-ins are not ten failures, and the check cannot tell them apart on its own — it runs before the hash. */
  it('forgives everything counted against the key', async () => {
    const limit = createRateLimit();
    await attempts(limit, 9);

    await limit({ action: 'login', key: 'ada', succeeded: true });

    expect((await attempts(limit, 10)).every(verdict => verdict.allowed)).toBe(true);
  });

  it('forgives only that key and that action', async () => {
    const limit = createRateLimit();
    await attempts(limit, 10, 'ada');

    await limit({ action: 'login', key: 'grace', succeeded: true });

    expect(await limit({ action: 'login', key: 'ada' })).toMatchObject({ allowed: false });
  });
});

/**
 * Signing in, counted by the address it comes from as well as the account: a stranger who knows a username could keep
 * its owner out with ten wrong passwords, and one password tried over many usernames from one address was never slowed.
 */
describe('signing in, by address', () => {
  const from = (address: string, key = 'ada') =>
    ({
      action: 'login',
      key,
      carrier: { headers: { 'x-forwarded-for': `${address}, 10.42.0.7` }, hostname: 'api' }
    }) as const;

  it("does not keep an account's owner out after a stranger's ten failures", async () => {
    const limit = createRateLimit();
    for (let i = 0; i < 12; i++) {
      await limit(from('203.0.113.9'));
    }

    expect(await limit(from('203.0.113.9'))).toMatchObject({ allowed: false });
    expect(await limit(from('198.51.100.4'))).toMatchObject({ allowed: true });
  });

  it('slows one password tried over fifty usernames from one address', async () => {
    const limit = createRateLimit();
    const verdicts = [];
    for (let i = 0; i < 50; i++) {
      verdicts.push(await limit(from('203.0.113.9', `user-${String(i)}`)));
    }

    expect(verdicts.slice(0, 30).every(verdict => verdict.allowed)).toBe(true);
    expect(verdicts.slice(30).every(verdict => !verdict.allowed)).toBe(true);
    expect(await limit(from('198.51.100.4', 'user-49'))).toMatchObject({ allowed: true });
  });

  /** `X-Forwarded-For` can be spelled by the client: rotating it buys more tries on one account, never unlimited ones. */
  it('holds one account to a ceiling however many addresses it is tried from', async () => {
    const limit = createRateLimit();
    const verdicts = [];
    for (let i = 0; i < 110; i++) {
      verdicts.push(await limit(from(`203.0.113.${String(i)}`)));
    }

    expect(verdicts.slice(0, 100).every(verdict => verdict.allowed)).toBe(true);
    expect(verdicts[100]).toMatchObject({ allowed: false });
  });

  it('lets the address in again once the window has passed', async () => {
    const limit = createRateLimit();
    for (let i = 0; i < 11; i++) {
      await limit(from('203.0.113.9'));
    }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);

    expect(await limit(from('203.0.113.9'))).toMatchObject({ allowed: true });

    vi.useRealTimers();
  });

  it('forgives the account on a success, and the address only that attempt', async () => {
    const limit = createRateLimit();
    for (let i = 0; i < 29; i++) {
      await limit(from('203.0.113.9', `user-${String(i)}`));
    }

    await limit(from('203.0.113.9', 'ada'));
    await limit({ ...from('203.0.113.9', 'ada'), succeeded: true });

    expect(await limit(from('203.0.113.9', 'grace'))).toMatchObject({ allowed: true });
    expect(await limit(from('203.0.113.9', 'linus'))).toMatchObject({ allowed: false });
  });
});
