// Packages
import { useAuth0 } from '@auth0/auth0-react';
import { useCache } from '@plitzi/plitzi-ui/Cache';
import { useMemo, useEffect, useCallback } from 'react';

// Relatives
import BasicProvider from './managers/BasicProvider';

// Types
import type { Schema } from '@plitzi/sdk-shared';

export type UseAuthProps = {
  provider: Schema['settings']['userProvider'];
  loginUrl: Schema['settings']['loginUrl'];
  refreshUrl: Schema['settings']['refreshUrl'];
  detailsPath: Schema['settings']['detailsPath'];
  tokenPath: Schema['settings']['tokenPath'];
  expirationTimePath: Schema['settings']['expirationTimePath'];
  webId: string | number;
};

const useAuth = ({
  provider,
  loginUrl,
  refreshUrl,
  detailsPath = 'details',
  tokenPath = 'access_token',
  expirationTimePath = 'expire_at',
  webId = 0
}: UseAuthProps) => {
  const [cache, setCache, , clearCache] = useCache({ cacheId: `user_${webId}_state`, skipContext: true });
  const manager = useMemo(() => {
    switch (provider) {
      case 'auth0': {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const authData = useAuth0();

        return {
          login: authData.loginWithRedirect,
          logout: authData.logout,
          refreshDetails: authData.getAccessTokenSilently,
          // can: authData.isAuthenticated,
          isAuthenticated: authData.isAuthenticated,
          can: () => true,
          userDetails: authData.user,
          // accessToken: authData.accessToken
          accessToken: authData.getAccessTokenSilently(),
          setCache: undefined,
          clearCache: undefined
        };
      }

      case 'basic':
        return new BasicProvider({
          cache: cache as Record<string, unknown>,
          setCache,
          clearCache,
          loginUrl,
          refreshUrl,
          detailsPath,
          tokenPath,
          expirationTimePath
        });

      case '':
      default:
        return undefined;
    }
  }, [provider, cache, setCache, clearCache, loginUrl, refreshUrl, detailsPath, tokenPath, expirationTimePath]);

  const handleWindowFocus = useCallback(async (): Promise<void> => {
    if (manager && manager.isAuthenticated) {
      const data = await manager.refreshDetails().catch(() => void manager.logout());
      if (!data || (typeof data === 'object' && data.errors)) {
        void manager.logout();
      } else {
        // manager.setExpiration();
      }
    }
  }, [manager]);

  useEffect(() => {
    window.addEventListener('focus', () => void handleWindowFocus());

    return () => {
      window.removeEventListener('focus', () => void handleWindowFocus());
    };
  }, [handleWindowFocus]);

  if (manager) {
    manager.setCache = setCache;
    manager.clearCache = clearCache;
  }

  return { manager };
};

export default useAuth;
