import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import AuthContext from '@plitzi/sdk-auth/AuthContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import GlobalSources from './GlobalSources';

import type { AuthContextValue, NavigationContextValue } from '@plitzi/sdk-shared';

const navigation = {
  routeParams: {},
  queryParams: {},
  hostname: 'example.test',
  currentPageId: 'page-1'
} as unknown as NavigationContextValue;

const authValue = {
  authenticated: true,
  user: { accessToken: 'token-abc', details: { username: 'ada', email: 'ada@example.test' } }
} as unknown as AuthContextValue;

const authSourceFor = (userProvider: string): Record<string, unknown> => {
  let published: Record<string, unknown> = {};
  const Probe = () => {
    const [auth = {}] = useCommonStore('runtime.sources.auth');
    published = auth;

    return null;
  };

  render(
    <StoreProvider value={{ schema: { settings: { userProvider }, variables: [] }, pageDefinitions: {} }}>
      <NavigationContext value={navigation}>
        <AuthContext value={authValue}>
          <GlobalSources>
            <Probe />
          </GlobalSources>
        </AuthContext>
      </NavigationContext>
    </StoreProvider>
  );

  return published;
};

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
