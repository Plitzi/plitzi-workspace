import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { renewThroughToken, revokeGrant, signInThroughBrowser } from './signIn';

/**
 * The sign-in flow as the MAIN process runs it, and above all: over whose network stack.
 *
 * This exists because of a failure no stubbed transport could have found. Every call here used Node's global
 * `fetch`, which carries its own bundled certificate authorities and knows nothing about the machine's — so
 * against a development server with a locally-issued certificate it threw `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
 * before a request was ever made. The window beside it, being Chromium, had been talking to that same host all
 * along, which is what made it so confusing: the renderer's calls returned 401s while the main process could not
 * reach the host at all.
 *
 * Verified against a real server, in a real Electron, before this was written: `net.fetch` answered 201 and the
 * global `fetch` threw `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on the same URL in the same process.
 *
 * So `fetch` is not stubbed here — it is a TRAP. Any call to it fails the test, which is the only way to keep a
 * later edit from quietly reintroducing exactly this.
 */

const netFetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
const openExternal = vi.fn<(url: string) => Promise<void>>(() => Promise.resolve());

vi.mock('electron', () => ({
  net: { fetch: (url: string, init: RequestInit) => netFetch(url, init) },
  shell: { openExternal: (url: string) => openExternal(url) }
}));

const API = 'https://api.plitzi.test';

const json = (status: number, body: unknown): Response => ({ status, json: () => Promise.resolve(body) }) as Response;

/** The message a failure carried, or nothing — so an assertion reads as one line rather than a narrowing dance. */
const errorOf = (result: { ok: boolean; error?: string }): string | undefined => (result.ok ? undefined : result.error);

/** What Node's `fetch` does against a certificate this machine has no reason to trust. */
const certificateRefused = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });

beforeEach(() => {
  netFetch.mockReset();
  openExternal.mockReset();
  openExternal.mockResolvedValue(undefined);
  // The trap. Nothing in this module may reach for the global.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('signIn reached for the global fetch, which does not know this machine certificates');
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signing in from the main process', () => {
  it('registers over Electron network stack, and not over Node own', async () => {
    netFetch.mockRejectedValue(certificateRefused());

    await signInThroughBrowser(API);

    expect(netFetch).toHaveBeenCalled();
    expect(netFetch.mock.calls[0][0]).toBe(`${API}/register`);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  /**
   * The message somebody reads when it goes wrong. It used to be "This server would not register the app." for
   * every cause — including a server that was never reached — which sends a person to look at the wrong end of the
   * problem, and cost exactly that.
   */
  it('says the host could not be reached, rather than blaming the server for refusing', async () => {
    netFetch.mockRejectedValue(certificateRefused());

    const result = await signInThroughBrowser(API);

    expect(result.ok).toBe(false);
    expect(errorOf(result)).toContain('Could not reach https://api.plitzi.test');
    expect(errorOf(result)).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    // And no browser was opened for a flow that could not start.
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('reports what the server said when it is the server that refused', async () => {
    netFetch.mockResolvedValue(json(400, { error: 'invalid_redirect_uri', error_description: 'Loopback only.' }));

    const result = await signInThroughBrowser(API);

    expect(errorOf(result)).toBe('Loopback only.');
  });

  /** A gateway in front of the API answers in HTML, and reading that as JSON throws — which looks like a refusal. */
  it('does not read an HTML error page as a refusal', async () => {
    netFetch.mockResolvedValue({ status: 502, json: () => Promise.reject(new Error('not json')) } as Response);

    const result = await signInThroughBrowser(API);

    expect(errorOf(result)).toContain('502');
  });

  /**
   * The whole journey, driven through the real loopback listener: register, open the browser, take the code that
   * comes back to the port, and exchange it. `openExternal` stands in for the person finishing in the browser.
   */
  it('comes back with a session once the browser returns a code to the loopback port', async () => {
    netFetch.mockImplementation((url: string) => {
      if (url.endsWith('/register')) {
        return Promise.resolve(json(201, { client_id: 'client-1' }));
      }

      return Promise.resolve(json(200, { access_token: 'granted', refresh_token: 'renew', expires_in: 3600 }));
    });
    openExternal.mockImplementation(async (authorizeUrl: string) => {
      const authorize = new URL(authorizeUrl);
      const back = new URL(authorize.searchParams.get('redirect_uri') ?? '');
      back.searchParams.set('code', 'the-code');
      back.searchParams.set('state', authorize.searchParams.get('state') ?? '');
      await fetchLoopback(back.toString());
    });

    const result = await signInThroughBrowser(API);

    expect(result).toMatchObject({ ok: true, clientId: 'client-1', accessToken: 'granted', refreshToken: 'renew' });
    // PKCE, and the challenge method the server demands — a native client keeps no secret, so this is the binding.
    const authorize = new URL(openExternal.mock.calls[0][0]);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/u);
  });

  it('ignores an answer arriving at the port with somebody else state', async () => {
    netFetch.mockResolvedValue(json(201, { client_id: 'client-1' }));
    openExternal.mockImplementation(async (authorizeUrl: string) => {
      const back = new URL(new URL(authorizeUrl).searchParams.get('redirect_uri') ?? '');
      back.searchParams.set('code', 'the-code');
      back.searchParams.set('state', 'not-this-flow');
      await fetchLoopback(back.toString());
    });

    // Answered immediately rather than after the five-minute wait: a reply whose `state` is not this flow settles
    // the listener with nothing, which is the same outcome as nobody ever coming back.
    const result = await signInThroughBrowser(API);

    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });
});

describe('renewing from the main process', () => {
  it('renews over Electron own stack', async () => {
    netFetch.mockResolvedValue(json(200, { access_token: 'fresh', expires_in: 3600 }));

    const result = await renewThroughToken(API, 'client-1', 'refresh');

    expect(result).toMatchObject({ ok: true, accessToken: 'fresh' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  /**
   * The distinction the renderer acts on: it ends the session on `refused` and leaves it alone on anything else.
   * A closed laptop lid, or a certificate this machine cannot verify, must not sign anybody out.
   */
  it('does not call an unreachable server a refusal', async () => {
    netFetch.mockRejectedValue(certificateRefused());

    const result = await renewThroughToken(API, 'client-1', 'refresh');

    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
  });

  it('calls a refusal a refusal, so the window stops trying', async () => {
    netFetch.mockResolvedValue(json(400, { error: 'invalid_grant' }));

    const result = await renewThroughToken(API, 'client-1', 'refresh');

    expect(result).toMatchObject({ ok: false, reason: 'refused', error: 'invalid_grant' });
  });
});

describe('revoking from the main process', () => {
  it('ends the grant over Electron own stack, and never throws', async () => {
    netFetch.mockRejectedValue(certificateRefused());

    await expect(revokeGrant(API, 'client-1', 'refresh')).resolves.toBeUndefined();
    expect(netFetch.mock.calls[0][0]).toBe(`${API}/revoke`);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

/** A real request to the loopback listener, made with Node's http rather than the trapped global fetch. */
const fetchLoopback = (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    void import('node:http').then(({ get }) => {
      get(url, response => {
        response.resume();
        response.on('end', () => resolve());
      }).on('error', reject);
    });
  });
