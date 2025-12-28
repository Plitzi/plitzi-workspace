import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthManager } from '../../AuthManager';

import type { AuthEvent } from '../../AuthProvider';
import type { AuthContextValue, Schema } from '@plitzi/sdk-shared';

export type UseAuthProps = {
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

const useAuth = ({
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
  const [loading, setLoading] = useState(!!userUrl);
  const [authenticated, setAuthenticated] = useState(false);
  const handleState = useCallback((event: AuthEvent) => {
    if (event.type === 'state') {
      setLoading(event.state === 'initLoading');
      setAuthenticated(event.state === 'authenticated');
    }
  }, []);

  const manager = useMemo(() => {
    const manager = new AuthManager<Exclude<Exclude<AuthContextValue['user'], undefined>['details'], undefined>>(
      provider as 'basic',
      handleState,
      { tokenStorage, loginUrl, userUrl, refreshUrl, logoutUrl, detailsPath, tokenPath, expirationTimePath }
    );

    void manager.init();

    return manager;
  }, [
    tokenStorage,
    detailsPath,
    expirationTimePath,
    handleState,
    loginUrl,
    logoutUrl,
    provider,
    refreshUrl,
    tokenPath,
    userUrl
  ]);

  useEffect(() => {
    const providerInstance = manager.getProvider();
    if (!providerInstance.token?.expiresAt) {
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

  const hookValue = useMemo(() => ({ manager, loading, authenticated }), [loading, manager, authenticated]);

  return hookValue;
};

export default useAuth;
