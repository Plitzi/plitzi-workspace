import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import BasicAuthProvider from './BasicAuthProvider';

const mockFetch = vi.fn<typeof fetch>();

const STORAGE_KEY = 'plitzi_auth_session';

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const session = (expiresAt: number) => ({
  details: { id: 1, username: 'ada', permissions: ['spaceManage'] },
  access_token: 'token',
  expire_at: expiresAt,
  refresh_token: 'refresh',
  refresh_expire_at: expiresAt + 3600
});

const storeSession = (expiresAt: number, validatedAt = inSeconds(0)) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      user: { id: 1, username: 'ada', permissions: ['spaceManage'] },
      token: { accessToken: 'stored', expiresAt, refreshToken: 'stored-refresh' },
      validatedAt
    })
  );
};

const plitziApi = {
  loginUrl: 'https://api.example.com/auth/login',
  userUrl: 'https://api.example.com/auth/session',
  refreshUrl: 'https://api.example.com/auth/refresh',
  logoutUrl: 'https://api.example.com/auth/logout'
};

beforeAll(() => {
  vi.stubGlobal('fetch', mockFetch);
});

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  document.cookie = 'plitzi_auth_hint=; Max-Age=0';
});

describe('BasicAuthProvider grants', () => {
  it('takes identity and both tokens from a login response', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    const token = await provider.login({ username: 'ada', password: 'pw' });

    expect(token?.accessToken).toBe('token');
    expect(token?.refreshToken).toBe('refresh');
    expect(provider.user).toMatchObject({ username: 'ada' });
    expect(provider.getState()).toBe('authenticated');
    // The grant carried the user, so nothing had to ask who signed in.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('asks the identity endpoint only when the grant did not say who it was for', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expire_at: inSeconds(3600) }))
      .mockResolvedValueOnce(jsonResponse({ details: { id: 1, username: 'ada' } }));

    await provider.login({ username: 'ada', password: 'pw' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(provider.user).toMatchObject({ username: 'ada' });
  });

  it('sends the refresh token under the name the backend reads it by', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, refreshTokenPath: 'refresh_token' });
    storeSession(inSeconds(-10));
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.init();

    expect(mockFetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ refresh_token: 'stored-refresh' })
    });
  });

  it('reports a failed login without ending up authenticated', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Invalid credentials', reason: 'missing' }, 401));

    expect(await provider.login({ username: 'ada', password: 'wrong' })).toBeUndefined();
    expect(provider.getState()).toBe('guest');
  });
});

describe('BasicAuthProvider boot', () => {
  it('restores a stored session without asking anyone', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(3600));

    await provider.init();

    expect(provider.getState()).toBe('authenticated');
    expect(provider.can('spaceManage')).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('renews a stored session whose token has lapsed, and gets the identity back with it', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(-10));
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.init();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(plitziApi.refreshUrl);
    expect(provider.getState()).toBe('authenticated');
  });

  it('renders as a guest with no request when the hint cookie says nobody is signed in', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionHintCookie: 'plitzi_auth_hint' });
    storeSession(inSeconds(3600));

    await provider.init();

    expect(provider.getState()).toBe('guest');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('picks up a session established by another app on the domain, with nothing in storage', async () => {
    document.cookie = `plitzi_auth_hint=${inSeconds(3600)}.${inSeconds(7200)}`;
    const provider = new BasicAuthProvider({ ...plitziApi, sessionHintCookie: 'plitzi_auth_hint' });
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.init();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(provider.getState()).toBe('authenticated');
  });

  // The rule: no evidence, no request. A page that calls the API "just in case" collects a 401 for every
  // signed-out visitor on every load — a request that could never have succeeded, and noise in the logs that says
  // nothing. Evidence is a stored credential or the hint cookie; the backend judges whether it is any good.
  it('never asks anyone when the browser shows no sign of a session', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });

    await provider.init();

    expect(provider.getState()).toBe('guest');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not go looking for a 401 when a signed-out tab is focused again', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    await provider.init();

    await provider.revalidate();
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(provider.getState()).toBe('guest');
  });

  // Evidence appearing later is picked up: sign in on a sibling app and this tab notices on its next focus,
  // without having polled for it.
  it('picks up a session that appeared elsewhere when revalidating', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionHintCookie: 'plitzi_auth_hint' });
    await provider.init();
    expect(mockFetch).not.toHaveBeenCalled();

    document.cookie = `plitzi_auth_hint=${inSeconds(3600)}.${inSeconds(7200)}`;
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.revalidate();

    expect(provider.getState()).toBe('authenticated');
  });

  it('trusts a server-rendered identity over everything, and stores it', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });

    await provider.init({ user: { id: 9, username: 'grace' }, accessToken: 'ssr', expiresAt: inSeconds(3600) });

    expect(provider.getState()).toBe('authenticated');
    expect(provider.token?.accessToken).toBe('ssr');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('grace');
  });

  it('reads the lifetime off the token when the backend states none', async () => {
    const jwt = `x.${btoa(JSON.stringify({ exp: inSeconds(3600) }))}.y`;
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse({ details: { id: 1 }, access_token: jwt }));

    await provider.login({ username: 'ada', password: 'pw' });
    mockFetch.mockClear();

    const restored = new BasicAuthProvider({ ...plitziApi });
    await restored.init();

    expect(restored.getState()).toBe('authenticated');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// The base class has to serve providers that do not sign in with a request at all — OAuth and OIDC send the browser
// to an identity provider and get it back with a code. This is the seam they hang off.
describe('AuthProvider redirect sign-in', () => {
  class RedirectProvider extends BasicAuthProvider {
    consumed = 0;

    protected consumeRedirect() {
      this.consumed += 1;
      const code = new URLSearchParams(window.location.search).get('code');
      if (!code) {
        return Promise.resolve(undefined);
      }

      return Promise.resolve({
        ok: true as const,
        user: { id: 5, username: 'redirected' },
        token: { accessToken: `exchanged-${code}`, expiresAt: inSeconds(3600), refreshToken: null }
      });
    }
  }

  it('takes a grant out of the URL before anything stored, and never asks the backend', async () => {
    window.history.replaceState({}, '', '/?code=abc123');
    storeSession(inSeconds(3600));
    const provider = new RedirectProvider({ ...plitziApi });

    await provider.init({ user: { id: 1, username: 'ada' } });

    expect(provider.getState()).toBe('authenticated');
    expect(provider.user).toMatchObject({ username: 'redirected' });
    expect(provider.token?.accessToken).toBe('exchanged-abc123');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls through to the normal decision when the URL carries no grant', async () => {
    window.history.replaceState({}, '', '/');
    storeSession(inSeconds(3600));
    const provider = new RedirectProvider({ ...plitziApi });

    await provider.init();

    expect(provider.consumed).toBe(1);
    expect(provider.user).toMatchObject({ username: 'ada' });
  });
});

// A credential obtained in the browser is invisible to the server that renders the pages, which then renders every
// one of them as a guest — and the page changes under the visitor as it hydrates. Handing it over is what closes
// that gap, so this is the seam that decides whether a space using a client-side provider flickers.
describe('AuthProvider handing a browser-obtained credential to the server', () => {
  const exchangeUrl = 'https://api.example.com/auth/exchange';

  it('hands the credential over after a login and keeps the session the server issued', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionExchangeUrl: exchangeUrl, spaceKey: 'web-key' });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ details: { id: 1, username: 'ada' }, access_token: 'idp-token' }))
      .mockResolvedValueOnce(
        jsonResponse({ details: { id: 1, username: 'ada' }, access_token: 'server-token', expire_at: inSeconds(3600) })
      );

    await provider.login({ username: 'ada', password: 'pw' });

    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe(exchangeUrl);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ provider: 'basic', token: 'idp-token' });
    // The space credential rides along: the backend cannot check the provider against the space without it.
    expect((init as RequestInit).headers).toMatchObject({ 'x-access-token': 'web-key' });
    // The server's session wins — it is the one its cookies and its renderer will honour.
    expect(provider.token?.accessToken).toBe('server-token');
  });

  it('ends the session when the server refuses the credential, rather than failing on every later call', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionExchangeUrl: exchangeUrl, spaceKey: 'web-key' });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ details: { id: 1 }, access_token: 'idp-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Token Invalid', reason: 'revoked' }, 401));

    await provider.login({ username: 'ada', password: 'pw' });

    expect(provider.getState()).toBe('guest');
  });

  it('keeps a good sign-in when the hand-off cannot reach the server', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionExchangeUrl: exchangeUrl, spaceKey: 'web-key' });
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ details: { id: 1 }, access_token: 'idp-token', expire_at: inSeconds(3600) })
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await provider.login({ username: 'ada', password: 'pw' });

    expect(provider.getState()).toBe('authenticated');
    expect(provider.token?.accessToken).toBe('idp-token');
  });

  it('does nothing at all when the space declares no exchange', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.login({ username: 'ada', password: 'pw' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('BasicAuthProvider failures', () => {
  it('keeps the session when the backend cannot be reached', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(3600), inSeconds(-9999));
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    await provider.init();

    expect(provider.getState()).toBe('authenticated');
    expect(provider.user).toMatchObject({ username: 'ada' });
  });

  it('keeps the session when the backend answers 500', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(3600), inSeconds(-9999));
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    await provider.init();

    expect(provider.getState()).toBe('authenticated');
  });

  // The confirmation of a stored session happens behind the render, so these assert what it settles on rather than
  // what `init` returns — that gap is the point of the optimistic gate.
  it('ends the session when the backend says the credential was revoked', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(3600), inSeconds(-9999));
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Token Invalid', reason: 'revoked' }, 401));

    await provider.init();
    expect(provider.getState()).toBe('authenticated');

    await vi.waitFor(() => expect(provider.getState()).toBe('guest'));
    expect(provider.user).toBeUndefined();
  });

  it('renews rather than signing out when a refusal is renewable', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(3600), inSeconds(-9999));
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Token expired', reason: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse(session(inSeconds(3600))));

    await provider.init();

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls[1][0]).toBe(plitziApi.refreshUrl);
    expect(provider.getState()).toBe('authenticated');
  });

  it('waits for the confirmation before rendering when the space asks it to', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi, sessionGate: 'strict' });
    storeSession(inSeconds(3600), inSeconds(-9999));
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Token Invalid', reason: 'revoked' }, 401));

    await provider.init();

    expect(provider.getState()).toBe('guest');
  });

  it('shares one renewal between concurrent callers', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    storeSession(inSeconds(-10));
    mockFetch.mockResolvedValue(jsonResponse(session(inSeconds(3600))));

    await Promise.all([provider.init(), provider.refresh(), provider.refresh()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// The interaction offers a `token` mode, and the provider has to honour it. A rewrite that mapped only
// username/password turned every token sign-in into `{ username: '', password: '' }` — the backend answered 400
// saying credentials were required, for a flow that was never meant to send any.
describe('signing in with a token the page already holds', () => {
  it('adopts it after confirming who it belongs to, and posts nothing', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse({ details: { id: 1, username: 'ada' } }));

    const token = await provider.login({ mode: 'token', token: 'handed-over' });

    expect(token?.accessToken).toBe('handed-over');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(plitziApi.userUrl);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer handed-over');
  });

  it('refuses one nothing vouches for, rather than reporting a session', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Token Invalid', reason: 'revoked' }, 401));

    expect(await provider.login({ mode: 'token', token: 'stale' })).toBeUndefined();
    expect(provider.token).toBeUndefined();
  });

  it('refuses an empty token without asking anyone', async () => {
    const provider = new BasicAuthProvider({ ...plitziApi });

    expect(await provider.login({ mode: 'token', token: '   ' })).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
