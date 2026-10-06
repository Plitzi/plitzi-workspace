import { render } from '@testing-library/react';
import { use } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

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
