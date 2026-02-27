import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthManager } from '../../AuthManager';

import type { AuthEvent } from '../../AuthProvider';
import type { AuthContextValue, Schema, Server } from '@plitzi/sdk-shared';

export type UseAuthProps = {
  server?: Server;
  isHydrating?: boolean;
  tokenStorage?: Schema['settings']['tokenStorage'];
  provider?: Schema['settings']['userProvider'];
  loginUrl?: Schema['settings']['loginUrl'];
  userUrl?: Schema['settings']['userUrl'];
  refreshUrl?: Schema['settings']['refreshUrl'];
  logoutUrl?: Schema['settings']['logoutUrl'];
  detailsPath?: Schema['settings']['detailsPath'];
  tokenPath?: Schema['settings']['tokenPath'];
  expirationTimePath?: Schema['settings']['expirationTimePath'];
};

type User = Exclude<Exclude<AuthContextValue['user'], undefined>['details'], undefined>;

const useAuth = ({
  server,
  isHydrating = false,
  tokenStorage = 'localStorage',
  provider = '',
  loginUrl = '',
  userUrl = '',
  refreshUrl = '',
  logoutUrl = '',
  detailsPath = 'details',
  tokenPath = 'access_token',
  expirationTimePath = 'expire_at'
}: UseAuthProps) => {
  const isSSR = typeof window === 'undefined' || isHydrating || (!!server?.user && server.authenticated);
  const [loading, setLoading] = useState(!!userUrl && !isSSR);
  const [authenticated, setAuthenticated] = useState(false);

  const handleState = useCallback((event: AuthEvent) => {
    if (event.type === 'state') {
      setLoading(event.state === 'initLoading');
      setAuthenticated(event.state === 'authenticated');
    }
  }, []);

  const manager = useMemo(() => {
    let props = {};
    if (provider === 'basic') {
      props = {
        tokenStorage,
        loginUrl,
        userUrl,
        refreshUrl,
        logoutUrl,
        detailsPath,
        tokenPath,
        expirationTimePath,
        isSSR
      };
    }

    const manager = new AuthManager<User>(provider as 'basic' | 'auth0', handleState, props);
    void manager.init(server?.authenticated ? server.user?.details : undefined, server?.skipAuth);

    return manager;
  }, [
    provider,
    handleState,
    server?.authenticated,
    server?.user?.details,
    server?.skipAuth,
    tokenStorage,
    loginUrl,
    userUrl,
    refreshUrl,
    logoutUrl,
    detailsPath,
    tokenPath,
    expirationTimePath,
    isSSR
  ]);

  useEffect(() => {
    const providerInstance = manager.getProvider();
    if (!providerInstance || !providerInstance.token?.expiresAt) {
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (providerInstance.token.expiresAt) {
      const handler = setTimeout(
        () => {
          void manager.logout();
        },
        Math.abs(currentTime - providerInstance.token.expiresAt) * 1000
      );

      return () => clearTimeout(handler);
    }
  }, [manager, authenticated]);

  const hookValue = useMemo(() => ({ manager, loading, authenticated }), [manager, loading, authenticated]);

  return hookValue;
};

export default useAuth;
