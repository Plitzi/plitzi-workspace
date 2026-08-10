import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';

import AuthInteractions from './AuthInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { AuthContextValue, InteractionCallback } from '@plitzi/sdk-shared';

const authValue = {
  login: () => Promise.resolve(undefined),
  refresh: () => Promise.resolve(undefined),
  logout: () => Promise.resolve(),
  can: () => false,
  revalidate: () => Promise.resolve(true),
  invalidate: () => {},
  state: 'authenticated',
  authenticated: true
} as unknown as AuthContextValue;

const registeredFor = (authProvider?: string): string[] => {
  let registered: Record<string, InteractionCallback> = {};
  const interactions = {
    interactionsManager: {},
    useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
      registered = callbacks ?? {};
    }
  } as unknown as InteractionsContextValue;

  render(
    <AuthContext value={authValue}>
      <InteractionsContext value={interactions}>
        <AuthInteractions authProvider={authProvider} />
      </InteractionsContext>
    </AuthContext>
  );

  return Object.keys(registered);
};

describe('AuthInteractions', () => {
  it('offers the auth callbacks on the built-in provider', () => {
    expect(registeredFor('basic')).toEqual(['login', 'refreshDetails', 'logout']);
  });

  // The regression this pins: the callbacks used to be gated on the literal name `basic`, so a space wired to a
  // registered provider had no way to sign in or out from an interaction even though the context supplied all three.
  it('offers them on any other provider a space declares', () => {
    expect(registeredFor('custom')).toEqual(['login', 'refreshDetails', 'logout']);
    expect(registeredFor('acme-oidc')).toEqual(['login', 'refreshDetails', 'logout']);
  });

  it('offers nothing when the space does not authenticate', () => {
    expect(registeredFor('')).toEqual([]);
  });
});
