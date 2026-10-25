import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthContext } from '@plitzi/sdk-auth';

import AuthInteractions from './AuthInteractions';
import { authCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { AuthContextValue, InteractionCallback } from '@plitzi/sdk-shared';

const authValue = {
  login: () => Promise.resolve({ ok: false as const, reason: 'missing' as const }),
  refresh: () => Promise.resolve(undefined),
  logout: () => Promise.resolve(),
  can: () => false,
  revalidate: () => Promise.resolve(true),
  invalidate: () => {},
  state: 'authenticated',
  authenticated: true
} as unknown as AuthContextValue;

/** The provider is the auth context's — the space's own, or the one the server that rendered it serves. */
const registrationFor = (provider: string): { id: string; names: string[] } => {
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
    <AuthContext value={{ ...authValue, provider }}>
      <InteractionsContext value={interactions}>
        <AuthInteractions />
      </InteractionsContext>
    </AuthContext>
  );

  return { id: moduleId, names: Object.keys(registered) };
};

const registeredFor = (provider: string): string[] => registrationFor(provider).names;

describe('AuthInteractions', () => {
  it('offers the auth callbacks on the built-in provider', () => {
    expect(registeredFor('basic')).toEqual(['login', 'refreshDetails', 'logout', 'logoutEverywhere']);
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
    expect(registeredFor('custom')).toEqual(['login', 'refreshDetails', 'logout', 'logoutEverywhere']);
    expect(registeredFor('acme-oidc')).toEqual(['login', 'refreshDetails', 'logout', 'logoutEverywhere']);
  });

  it('offers nothing when the space does not authenticate', () => {
    expect(registeredFor('')).toEqual([]);
  });

  // The regression this pins: a space that declared nothing used to be offered `login` as if it were on `basic`, and
  // the action then refused with `missing` without a request or a word in the console.
  it('offers nothing outside an auth provider at all', () => {
    let registered: Record<string, InteractionCallback> | undefined;
    const interactions = {
      interactionsManager: {},
      useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
        registered = callbacks;
      }
    } as unknown as InteractionsContextValue;

    render(
      <InteractionsContext value={interactions}>
        <AuthInteractions />
      </InteractionsContext>
    );

    expect(registered).toEqual({});
  });
});

describe('signing out everywhere from a flow', () => {
  // The step answered nothing, so a page could not say it was done.
  it('answers ok once the provider has signed out, and fails the step when the provider cannot', async () => {
    let registered: Record<string, InteractionCallback> = {};
    const interactions = {
      interactionsManager: {},
      useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
        registered = callbacks ?? {};
      }
    } as unknown as InteractionsContextValue; // Only what the source reads: where it registers its callbacks.
    const signOutEverywhere = (withIt: boolean) => {
      render(
        <AuthContext
          value={{
            ...authValue,
            provider: 'basic',
            ...(withIt ? { logoutEverywhere: () => Promise.resolve() } : {})
          }}
        >
          <InteractionsContext value={interactions}>
            <AuthInteractions />
          </InteractionsContext>
        </AuthContext>
      );

      return (params: Record<string, unknown>) => Promise.resolve(registered.logoutEverywhere.callback?.(params));
    };

    await expect(signOutEverywhere(true)({ scope: 'all' })).resolves.toEqual({ ok: true });
    await expect(signOutEverywhere(false)({ scope: 'site' })).rejects.toThrow('has no way to sign out everywhere');
  });
});
