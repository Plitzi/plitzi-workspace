import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import AuthContext from '@plitzi/sdk-auth/AuthContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { setThemeMode } from '@plitzi/sdk-shared/theme/themeStore';

import GlobalSources from './GlobalSources';

import type { AuthContextValue } from '@plitzi/sdk-shared';

const navigation = {
  routeParams: {},
  queryParams: {},
  hostname: 'example.test',
  currentPageId: 'page-1'
};

const authValue = {
  authenticated: true,
  user: { accessToken: 'token-abc', details: { username: 'ada', email: 'ada@example.test' } }
} as unknown as AuthContextValue;

const publishedSource = (
  path: 'runtime.sources.auth' | 'runtime.sources.theme',
  userProvider = 'basic'
): Record<string, unknown> => {
  let published: Record<string, unknown> = {};
  const Probe = () => {
    const [value = {}] = useCommonStore(path);
    published = value;

    return null;
  };

  render(
    <StoreProvider value={{ schema: { settings: { userProvider }, variables: [] }, pageDefinitions: {}, navigation }}>
      <AuthContext value={authValue}>
        <GlobalSources>
          <Probe />
        </GlobalSources>
      </AuthContext>
    </StoreProvider>
  );

  return published;
};

const authSourceFor = (userProvider: string): Record<string, unknown> =>
  publishedSource('runtime.sources.auth', userProvider);

describe('GlobalSources — the theme source', () => {
  afterEach(() => {
    setThemeMode('system');
  });

  it('publishes the chosen theme and the colour it resolves to', () => {
    setThemeMode('dark');

    expect(publishedSource('runtime.sources.theme')).toEqual({ mode: 'dark', resolved: 'dark' });
  });

  /** `system` is not a colour: a URL built from `mode` would carry a word the API has no picture for. */
  it('resolves `system` to the scheme the machine reports', () => {
    expect(publishedSource('runtime.sources.theme')).toEqual({ mode: 'system', resolved: 'light' });
  });
});

describe('GlobalSources — the auth source', () => {
  it('publishes the signed-in identity on the built-in provider', () => {
    const auth = authSourceFor('basic');

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.accessToken).toBe('token-abc');
    expect(auth.details).toMatchObject({ username: 'ada', email: 'ada@example.test' });
  });

  // The regression this pins: the source used to be built only for the literal provider name `basic`, so a space on
  // a registered provider bound `{{user.*}}` against an empty object while its visitor was signed in.
  it('publishes it the same way whatever provider the space declared', () => {
    for (const provider of ['custom', 'acme-oidc']) {
      const auth = authSourceFor(provider);

      expect(auth.isAuthenticated).toBe(true);
      expect(auth.accessToken).toBe('token-abc');
      expect(auth.details).toMatchObject({ username: 'ada' });
    }
  });

  it('publishes nothing when the space does not authenticate', () => {
    expect(authSourceFor('')).toEqual({});
  });
});
