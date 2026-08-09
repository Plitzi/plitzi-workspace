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
  userUrl: 'https://api.example.com/users/me',
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

  it('does not re-ask about a signed-out visitor on the next load', async () => {
    const first = new BasicAuthProvider({ ...plitziApi });
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Not authenticated', reason: 'missing' }, 401));

    await first.init();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(first.getState()).toBe('guest');

    const second = new BasicAuthProvider({ ...plitziApi });
    await second.init();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(second.getState()).toBe('guest');
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
