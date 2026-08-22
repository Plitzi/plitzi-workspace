import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';

import AuthInteractions from './AuthInteractions';
import { authCallbacks } from './callbacks';
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

const registrationFor = (authProvider?: string): { id: string; names: string[] } => {
  let registered: Record<string, InteractionCallback> = {};
  let moduleId = '';
  const interactions = {
    interactionsManager: {},
    useInteractions: ({ id, callbacks }: { id: string; callbacks?: Record<string, InteractionCallback> }) => {
      moduleId = id;
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

  return { id: moduleId, names: Object.keys(registered) };
};

const registeredFor = (authProvider?: string): string[] => registrationFor(authProvider).names;

describe('AuthInteractions', () => {
  it('offers the auth callbacks on the built-in provider', () => {
    expect(registeredFor('basic')).toEqual(['login', 'refreshDetails', 'logout']);
  });

  /**
   * The regression this pins is the one that has actually happened: the source registered `login`/`logout`/
   * `refreshDetails` while the catalog everything else reads declared `authLogin`/`authLogout`/
   * `authRefreshDetails`. Both halves were right about themselves, so nothing reported it — and every flow written
   * from the catalog looked up a name nothing had registered and quietly did nothing.
   */
  it('registers every declared callback under the name it is declared with', () => {
    expect(registeredFor('basic')).toEqual(Object.keys(authCallbacks));
  });

  /**
   * The other end of the same lookup. A step is resolved as `callbacksAvailables[<source>][<action>]`, so the
   * module each callback DECLARES it belongs to has to be the module it is actually registered on — a correct
   * action name on the wrong module is just as dead.
   */
  it('registers on the module its declarations name', () => {
    const sources = new Set(Object.values(authCallbacks).map(callback => callback.source));

    expect([...sources]).toEqual([registrationFor('basic').id]);
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
