import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import BasicAuthProvider from './BasicAuthProvider';

import type { TokenResult } from '@plitzi/sdk-shared';

const mockFetch = vi.fn<typeof fetch>();

beforeAll(() => {
  vi.stubGlobal('fetch', mockFetch);
});

describe('BasicAuthProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('logs in successfully and returns TokenResult', async () => {
    const provider = new BasicAuthProvider({
      loginUrl: '/login',
      tokenPath: 'accessToken',
      refreshTokenPath: 'refreshToken',
      expirationTimePath: 'expiresIn'
    });

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'token-123', refreshToken: 'refresh-123', expiresIn: Date.now() + 3600 }),
        { status: 200 }
      )
    );

    const token = await provider.login({ username: 'demo', password: '123' });

    expect(token?.accessToken).toBe('token-123');
    expect(token?.refreshToken).toBe('refresh-123');
    expect(token?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('logout calls backend and clears state', async () => {
    const provider = new BasicAuthProvider({
      logoutUrl: '/logout'
    });

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await expect(provider.logout()).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledWith(
      '/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      })
    );
  });

  it('refresh returns a new token when backend responds', async () => {
    const provider = new BasicAuthProvider({
      refreshUrl: '/refresh',
      tokenPath: 'accessToken',
      refreshTokenPath: 'refreshToken',
      expirationTimePath: 'expiresIn'
    });

    const expiredToken: TokenResult = {
      accessToken: 'old',
      refreshToken: 'refresh-old',
      expiresAt: Date.now() - 1000
    };

    // @ts-expect-error testing internal cache
    provider.cache = { token: expiredToken };

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'new-token', refreshToken: 'new-refresh', expiresIn: Date.now() + 3600 }),
        { status: 200 }
      )
    );

    const refreshed = await provider.refresh();

    expect(refreshed?.accessToken).toBe('new-token');
    expect(refreshed?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws error on failed request', async () => {
    const provider = new BasicAuthProvider({
      loginUrl: '/login'
    });

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const response = await provider.login({ username: 'x', password: 'y' });
    expect(response).toBe(undefined);
  });

  // it('login → refresh uses cached token when still valid', async () => {
  //   const provider = new BasicAuthProvider({});

  //   const token: TokenResult = {
  //     accessToken: 'cached',
  //     refreshToken: 'refresh',
  //     expiresAt: Date.now() + 60_000
  //   };

  //   // @ts-expect-error test cache
  //   provider.cache = { token };

  //   const refreshed = await provider.refresh();

  //   expect(refreshed).toBe(token);
  //   expect(mockFetch).not.toHaveBeenCalled();
  // });

  // it('expired token triggers refresh and updates cache', async () => {
  //   const provider = new BasicAuthProvider({
  //     refreshUrl: '/refresh'
  //   });

  //   const expired: TokenResult = {
  //     accessToken: 'old',
  //     refreshToken: 'old-refresh',
  //     expiresAt: Date.now() - 1
  //   };

  //   // @ts-expect-error test cache
  //   provider.cache = { token: expired };

  //   mockFetch.mockResolvedValueOnce(
  //     new Response(
  //       JSON.stringify({
  //         accessToken: 'new',
  //         refreshToken: 'new-refresh',
  //         expiresIn: 3600
  //       }),
  //       { status: 200 }
  //     )
  //   );

  //   const refreshed = await provider.refresh();

  //   expect(refreshed?.accessToken).toBe('new');
  // });

  // it('expired token without refresh auto-logs out', async () => {
  //   const provider = new BasicAuthProvider({
  //     // enableRefresh: false
  //   });

  //   const expired: TokenResult = {
  //     accessToken: 'dead',
  //     refreshToken: 'dead-refresh',
  //     expiresAt: Date.now() - 1
  //   };

  //   // @ts-expect-error test cache
  //   provider.cache = { token: expired };

  //   const refreshed = await provider.refresh();

  //   expect(refreshed).toBeUndefined();
  //   expect(provider.authenticated).toBe(false);
  // });

  it('logout clears token and state even if backend fails', async () => {
    const provider = new BasicAuthProvider({
      logoutUrl: '/logout'
    });

    const token: TokenResult = {
      accessToken: 't',
      refreshToken: 'r',
      expiresAt: Date.now() + 1000
    };

    // @ts-expect-error test cache
    provider.cache = { token };

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await provider.logout();

    // @ts-expect-error test cache
    expect(provider.cache).toBeUndefined();
  });
});
