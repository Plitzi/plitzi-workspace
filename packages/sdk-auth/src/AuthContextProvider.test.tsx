import { render } from '@testing-library/react';
import { use } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { reportAuthFailure } from '@plitzi/sdk-shared/auth';

import AuthContext from './AuthContext';
import AuthContextProvider from './AuthContextProvider';

import type { Schema, Server, ServerAuth } from '@plitzi/sdk-shared';

const served: ServerAuth = {
  userProvider: 'basic',
  loginUrl: '/auth/login',
  userUrl: '/auth/session',
  refreshUrl: '/auth/refresh',
  logoutUrl: '/auth/logout',
  sessionHintCookie: 'acme_session_hint'
};

const serverWith = (auth?: ServerAuth): Server => ({
  apiServer: '',
  ssrServer: '',
  serverUrl: '',
  websocketServer: '',
  subscriptionServer: '',
  ...(auth ? { auth } : {})
});

/** The provider the page ended up with, as everything below the auth context reads it. */
const providerFor = (settings: Partial<Schema['settings']>, server: Server): string | undefined => {
  let provider: string | undefined;
  const Probe = () => {
    provider = use(AuthContext).provider;

    return null;
  };

  render(
    <StoreProvider value={{ schema: { settings, variables: [] }, navigation: { queryParams: {} } }}>
      <AuthContextProvider server={server}>
        <Probe />
      </AuthContextProvider>
    </StoreProvider>
  );

  return provider;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

/**
 * A project served by `createServer({ auth })` declared nothing and got a sign-in form that did nothing: the server
 * served `/auth` and never told the page. These pin the three ways a page can come out of that.
 */
describe('which provider a page signs in with', () => {
  it('is the server’s when the space declares none', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());

    expect(providerFor({}, serverWith(served))).toBe('basic');
  });

  it('is the space’s when it declares one, whatever the server serves', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());

    expect(providerFor({ userProvider: 'server' }, serverWith(served))).toBe('server');
  });

  it('is none when neither names one', () => {
    expect(providerFor({}, serverWith())).toBe('');
  });

  // The endpoints arrive with it: the login posts where the server serves it, with nothing declared.
  it('signs in where the server serves it', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 }))
    );
    vi.stubGlobal('fetch', fetchMock);
    let login: ((params: Record<string, unknown>) => Promise<unknown>) | undefined;
    const Probe = () => {
      login = use(AuthContext).login;

      return null;
    };

    render(
      <StoreProvider value={{ schema: { settings: {}, variables: [] }, navigation: { queryParams: {} } }}>
        <AuthContextProvider server={serverWith(served)}>
          <Probe />
        </AuthContextProvider>
      </StoreProvider>
    );
    await login?.({ username: 'ada', password: 'pw' });

    expect(fetchMock).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'POST' }));
  });
});

/**
 * The builder reads the session's token through `auth.accessToken` (its `userKey`). A renewal stays `authenticated`, and
 * the page went on publishing the token it replaced: the builder asked with it, was refused, and said "Authentication
 * required" over a session that had just been renewed.
 */
describe('the token a page publishes', () => {
  afterEach(() => {
    document.cookie = 'acme_session_hint=; Max-Age=0';
  });

  it('is the renewed one once a refused request renewed the session', async () => {
    // The served session says it is alive through its hint cookie (`sessionHintCookie`); without it, it is gone.
    document.cookie = `acme_session_hint=${String(Math.floor(Date.now() / 1000) + 3600)}`;
    localStorage.setItem(
      'plitzi_auth_session',
      JSON.stringify({
        version: 1,
        user: { id: 1, username: 'ada' },
        token: { accessToken: 'first', expiresAt: Math.floor(Date.now() / 1000) + 3600, refreshToken: 'refresh' },
        validatedAt: Math.floor(Date.now() / 1000)
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(input =>
        Promise.resolve(
          input === '/auth/refresh'
            ? new Response(
                JSON.stringify({
                  details: { id: 1, username: 'ada' },
                  access_token: 'renewed',
                  expire_at: Math.floor(Date.now() / 1000) + 3600,
                  refresh_token: 'refresh-2'
                })
              )
            : new Response(JSON.stringify({ details: { id: 1, username: 'ada' } }))
        )
      )
    );
    const published: (string | undefined)[] = [];
    let state: string | undefined;
    const Probe = () => {
      const auth = use(AuthContext);
      published.push(auth.user?.accessToken);
      state = auth.state;

      return null;
    };

    render(
      <StoreProvider value={{ schema: { settings: {}, variables: [] }, navigation: { queryParams: {} } }}>
        <AuthContextProvider server={serverWith(served)}>
          <Probe />
        </AuthContextProvider>
      </StoreProvider>
    );
    // Settled, as a builder left open is: nothing else is about to render the page again.
    await vi.waitFor(() => expect(state).toBe('authenticated'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(published.at(-1)).toBe('first');

    expect(await reportAuthFailure({ reason: 'expired', url: '/auth/session' })).toBe(true);
    await vi.waitFor(() => expect(published.at(-1)).toBe('renewed'));
  });
});
