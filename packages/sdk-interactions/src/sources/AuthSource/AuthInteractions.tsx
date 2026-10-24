import { use, useMemo } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';
import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring';

import { authCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { AuthContextValue, InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthInteractionsProps = {
  children?: ReactNode;
};

const AuthInteractions = ({ children }: AuthInteractionsProps) => {
  // Read as partial: with no auth provider mounted the context is its default `{}`, whatever its type promises.
  const auth: Partial<AuthContextValue> = use(AuthContext);
  const { login, refresh, logout, logoutEverywhere, provider } = auth;
  const { useInteractions } = use(InteractionsContext);

  // Offered whenever the page has a provider to sign in with, whichever it is — the space's own, or the one the server
  // that rendered it serves. The three calls are the context's and every provider implements them; gating on the
  // name `basic` left spaces on a registered provider with no way to sign in or out from an interaction.
  const interactionCallbacks = useMemo((): Record<string, InteractionCallback> => {
    // No provider, no auth actions at all, rather than actions that cannot work.
    if (!provider || !login || !refresh || !logout) {
      return {};
    }

    // Keyed by the catalog, so the name a document writes and the name registered here cannot come apart.
    return toInteractionCallbacks(authCallbacks, {
      login: (params: Record<string, unknown>) => login(params),
      refreshDetails: (params: Record<string, unknown>) => refresh(params),
      logout: () => logout(),
      // A provider that cannot is left out of the step's work by its refusal: said, never a sign-out here alone.
      logoutEverywhere: (params: Record<string, unknown>) => {
        if (!logoutEverywhere) {
          return Promise.reject(new Error(`The ${provider} sign-in has no way to sign out everywhere`));
        }

        // Said done, as its catalog entry says it: a flow branches on `.ok`, a refusal fails the step.
        return logoutEverywhere(params.scope === 'all' ? 'all' : 'site').then(() => ({ ok: true }));
      }
    });
  }, [login, logout, logoutEverywhere, refresh, provider]);

  useInteractions({ id: 'auth', callbacks: interactionCallbacks });

  return children;
};

export default AuthInteractions;
