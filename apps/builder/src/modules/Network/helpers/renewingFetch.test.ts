import { afterEach, describe, expect, it, vi } from 'vitest';

import { onAuthFailure } from '@plitzi/sdk-shared/auth';

import { createCredential } from './credential';
import { CREDENTIAL_HEADER, renewingFetch } from './renewingFetch';

const URL_ = 'https://server.plitzi.test/';
// What the GraphQL server answers a request whose credential it refused: a 401 carrying its errors, and no `reason`.
const REFUSED = JSON.stringify({
  errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }],
  data: { Spaces: null }
});

const serverAccepting = (token: string) =>
  vi.fn((_input: URL | RequestInfo, init?: RequestInit) =>
    Promise.resolve(
      new Headers(init?.headers).get(CREDENTIAL_HEADER) === token
        ? new Response('{"data":{}}', { status: 200 })
        : new Response(REFUSED, { status: 401 })
    )
  );

let stops: (() => void)[] = [];
afterEach(() => {
  stops.forEach(stop => stop());
  stops = [];
});

describe('a request of the builder whose credential was refused', () => {
  // The column of "Authentication required" toasts: a tab back after its token's life asked everything at once with
  // the old token, and the GraphQL 401 — errors, not a transport failure — was never said to auth nor asked again.
  it('is said to auth, waits for the renewed credential and is asked again with it, once', async () => {
    const credential = createCredential('old');
    const reasons: string[] = [];
    const refused: (string | undefined)[] = [];
    stops.push(
      onAuthFailure(({ reason, credential: carried }) => {
        reasons.push(reason);
        refused.push(carried);
        // The page renews, and hands the builder its new token a moment after.
        setTimeout(() => credential.set('new'), 10);

        return true;
      })
    );
    const fetchImpl = serverAccepting('new');

    const response = await renewingFetch(fetchImpl, credential)(URL_, { headers: { [CREDENTIAL_HEADER]: 'old' } });

    expect(response.status).toBe(200);
    expect(reasons).toEqual(['expired']);
    // What lets auth tell a refusal of the live token from one of a token a renewal already replaced.
    expect(refused).toEqual(['old']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ [CREDENTIAL_HEADER]: 'new' });
  });

  it('is answered as it was when auth did not renew — a session that ended', async () => {
    const credential = createCredential('old');
    stops.push(onAuthFailure(() => false));
    const fetchImpl = serverAccepting('new');

    const response = await renewingFetch(fetchImpl, credential)(URL_, { headers: { [CREDENTIAL_HEADER]: 'old' } });

    expect(response.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('is asked again once at most, whatever the second answer', async () => {
    const credential = createCredential('old');
    stops.push(
      onAuthFailure(() => {
        credential.set('still-refused');

        return true;
      })
    );
    const fetchImpl = serverAccepting('new');

    const response = await renewingFetch(fetchImpl, credential)(URL_, { headers: { [CREDENTIAL_HEADER]: 'old' } });

    expect(response.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /** A renewal the page never hands the builder: asked again with the refused credential, it would be refused again. */
  it('says so and answers the refusal when no renewed credential reaches the builder', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const credential = createCredential('old');
      stops.push(onAuthFailure(() => true));
      const fetchImpl = serverAccepting('new');

      const answered = renewingFetch(fetchImpl, credential)(URL_, { headers: { [CREDENTIAL_HEADER]: 'old' } });
      await vi.advanceTimersByTimeAsync(3000);
      const response = await answered;

      expect(response.status).toBe(401);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('no new credential reached the builder'));
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it('leaves every other answer alone', async () => {
    const credential = createCredential('token');
    const listener = vi.fn(() => true);
    stops.push(onAuthFailure(listener));
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 403 })));

    const response = await renewingFetch(fetchImpl, credential)(URL_);

    expect(response.status).toBe(403);
    expect(listener).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('the credential', () => {
  it('answers the new one as soon as it is set, or the same one after the wait', async () => {
    vi.useFakeTimers();
    try {
      const credential = createCredential('a');
      const changed = credential.next('a', 3000);
      credential.set('b');
      await expect(changed).resolves.toBe('b');

      const unchanged = credential.next('b', 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(unchanged).resolves.toBe('b');
      await expect(credential.next('a', 3000)).resolves.toBe('b');
    } finally {
      vi.useRealTimers();
    }
  });
});
