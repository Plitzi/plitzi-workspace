import { use, useCallback, useMemo } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';
import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';

import { authCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthInteractionsProps = {
  children?: ReactNode;
  authProvider?: string;
};

const AuthInteractions = ({ children, authProvider = 'basic' }: AuthInteractionsProps) => {
  const { login, refresh, logout } = use(AuthContext);
  const { useInteractions } = use(InteractionsContext);

  const handleLogin = useCallback(
    (params: Parameters<NonNullable<InteractionCallback['callback']>>[0]) => login(params),
    [login]
  );

  const handleRefresh = useCallback(
    (params: Parameters<NonNullable<InteractionCallback['callback']>>[0]) => refresh(params),
    [refresh]
  );

  const handleLogout = useCallback(() => logout(), [logout]);

  // Offered whenever the space authenticates, whatever provider it declared — the three calls are the context's and
  // every provider implements them. Gating on the name `basic` left spaces on a registered provider with no way to
  // sign in or out from an interaction.
  const interactionCallbacks = useMemo((): Record<string, InteractionCallback> => {
    // A space with no auth provider offers no auth actions at all, rather than actions that cannot work.
    if (authProvider === '') {
      return {};
    }

    // Keyed by the catalog, so the name a document writes and the name registered here cannot come apart.
    return toInteractionCallbacks(authCallbacks, {
      login: handleLogin,
      refreshDetails: handleRefresh,
      logout: handleLogout
    });
  }, [handleLogin, handleLogout, handleRefresh, authProvider]);

  useInteractions({ id: 'auth', callbacks: interactionCallbacks });

  return children;
};

export default AuthInteractions;
