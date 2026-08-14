import { describe, expect, it, vi } from 'vitest';

import { createMemoryRateLimit } from './throttle';

/**
 * The limit a deployment gets for free. What matters is not the numbers — those are a judgement — but that it is
 * there at all: this used to be an option with no default, which meant the ordinary deployment shipped an
 * unmetered password endpoint because nobody configures what they have not read about.
 */

const attempts = async (limit: ReturnType<typeof createMemoryRateLimit>, count: number, key = 'ada') => {
  const verdicts = [];
  for (let i = 0; i < count; i++) {
    verdicts.push(await limit({ action: 'login', key }));
  }

  return verdicts;
};

describe('the built-in rate limit', () => {
  it('lets a normal number of attempts through and then stops', async () => {
    const verdicts = await attempts(createMemoryRateLimit(), 12);

    expect(verdicts.slice(0, 10).every(verdict => verdict.allowed)).toBe(true);
    expect(verdicts[10]).toMatchObject({ allowed: false });
    expect(verdicts[11]).toMatchObject({ allowed: false });
  });

  /** So a client knows to come back rather than hammering, and so a UI can say how long. */
  it('says when to try again', async () => {
    const verdicts = await attempts(createMemoryRateLimit(), 11);
    const refused = verdicts[10] as { retryAfter?: number };

    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(300);
  });

  it('counts each account separately, so one person cannot lock another out', async () => {
    const limit = createMemoryRateLimit();
    await attempts(limit, 11, 'ada');

    expect(await limit({ action: 'login', key: 'grace' })).toMatchObject({ allowed: true });
  });

  it('counts each kind of attempt separately', async () => {
    const limit = createMemoryRateLimit();
    await attempts(limit, 11, 'ada');

    expect(await limit({ action: 'forgotPassword', key: 'ada' })).toMatchObject({ allowed: true });
  });

  /** A sliding window: somebody who was locked out gets back in, without anybody having to clear anything. */
  it('forgives once the window has passed', async () => {
    const limit = createMemoryRateLimit();
    await attempts(limit, 11);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);

    expect(await limit({ action: 'login', key: 'ada' })).toMatchObject({ allowed: true });

    vi.useRealTimers();
  });

  /** Six digits is a million guesses; the limit is what makes a second factor worth having. */
  it('is tightest where the secret is shortest', async () => {
    const limit = createMemoryRateLimit();
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
    const limit = createMemoryRateLimit();
    await attempts(limit, 9);

    await limit({ action: 'login', key: 'ada', succeeded: true });

    expect((await attempts(limit, 10)).every(verdict => verdict.allowed)).toBe(true);
  });

  it('forgives only that key and that action', async () => {
    const limit = createMemoryRateLimit();
    await attempts(limit, 10, 'ada');

    await limit({ action: 'login', key: 'grace', succeeded: true });

    expect(await limit({ action: 'login', key: 'ada' })).toMatchObject({ allowed: false });
  });
});
