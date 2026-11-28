import { CloseCode } from 'graphql-ws';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onAuthFailure } from '@plitzi/sdk-shared/auth';

import { createCredential } from './credential';
import { subscriptionRenewal } from './subscriptionRenewal';

import type { AuthFailureSignal } from '@plitzi/sdk-shared/auth';

const URL_ = 'wss://server.plitzi.test/subscriptions';
const refusedSession = (reason: string) => ({ code: CloseCode.Forbidden, reason });

let stops: (() => void)[] = [];
afterEach(() => {
  stops.forEach(stop => stop());
  stops = [];
  vi.useRealTimers();
});

/** Auth renewing on every report, and the page handing the builder each new token a moment after. */
const renewingAuth = (credential: ReturnType<typeof createCredential>) => {
  const reports: AuthFailureSignal[] = [];
  let renewals = 0;
  stops.push(
    onAuthFailure(signal => {
      reports.push(signal);
      renewals += 1;
      setTimeout(() => credential.set(`renewed-${String(renewals)}`), 10);

      return true;
    })
  );

  return reports;
};

describe('the subscriptions across a renewal', () => {
  /**
   * A tab back after a day reconnected with the token it had: the server refused each subscription with "Token
   * expired", the stream ended, and live edits from others stopped until the page was loaded again.
   */
  it('reconnect with the renewed credential as soon as a refusal of the session renewed it', async () => {
    const credential = createCredential('old');
    const reports = renewingAuth(credential);
    const renewal = subscriptionRenewal(credential, URL_);

    expect(renewal.credentialToSend()).toBe('old');
    renewal.on.closed(refusedSession('expired'));
    const started = Date.now();
    await renewal.retryWait(0);

    expect(reports).toEqual([{ reason: 'expired', url: URL_, credential: 'old' }]);
    expect(renewal.credentialToSend()).toBe('renewed-1');
    // The renewal, not the backoff's second or more, is what it waited for.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('renew nothing for a renewed credential refused again before any connection was accepted', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const credential = createCredential('old');
      const reports = renewingAuth(credential);
      const renewal = subscriptionRenewal(credential, URL_);
      renewal.credentialToSend();
      renewal.on.closed(refusedSession('expired'));
      const first = renewal.retryWait(0);
      await vi.advanceTimersByTimeAsync(10);
      await first;

      renewal.credentialToSend();
      renewal.on.closed(refusedSession('revoked'));

      expect(reports).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused again'));
    } finally {
      warn.mockRestore();
    }
  });

  it('renew again once a connection was accepted in between', async () => {
    const credential = createCredential('old');
    const reports = renewingAuth(credential);
    const renewal = subscriptionRenewal(credential, URL_);
    renewal.credentialToSend();
    renewal.on.closed(refusedSession('expired'));
    await renewal.retryWait(0);
    renewal.credentialToSend();
    renewal.on.connected();

    // A day later, the renewed one expired too.
    renewal.on.closed(refusedSession('expired'));
    await renewal.retryWait(0);

    expect(reports.map(report => report.credential)).toEqual(['old', 'renewed-1']);
  });

  it('leaves any other close to graphql-ws, backing off', async () => {
    vi.useFakeTimers();
    const credential = createCredential('old');
    const reports = renewingAuth(credential);
    const renewal = subscriptionRenewal(credential, URL_);

    renewal.on.closed({ code: 1006, reason: '' });
    let waited = false;
    const wait = renewal.retryWait(0).then(() => {
      waited = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(waited).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    await wait;

    expect(waited).toBe(true);
    expect(reports).toEqual([]);
  });
});
