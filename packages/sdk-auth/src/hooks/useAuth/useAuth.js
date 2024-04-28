// Packages
import { useMemo, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Relatives
import BasicProvider from './managers/BasicProvider';

/**
 * @param {{
 *   provider: string;
 *   loginUrl: string;
 *   refreshUrl: string;
 *   detailsPath?: string;
 *   tokenPath?: string;
 *   expirationTimePath?: string;
 *   webId: number;
 * }} props
 * @returns {{
 *   manager: object;
 * }}
 */
const useAuth = props => {
  const {
    provider,
    loginUrl,
    refreshUrl,
    detailsPath = 'details',
    tokenPath = 'access_token',
    expirationTimePath = 'expire_at',
    webId = 0
  } = props;
  const [cache, setCache, , clearCache] = useCache({ cacheId: `user-${webId}-state`, skipContext: true });
  const manager = useMemo(() => {
    switch (provider) {
      case 'auth0': {
        const authData = useAuth0();

        return {
          login: authData.loginWithRedirect,
          logout: authData.logout,
          refreshDetails: authData.getAccessTokenSilently,
          // can: authData.isAuthenticated,
          isAuthenticated: authData.isAuthenticated,
          can: () => true,
          userDetails: authData.user,
          accessToken: authData.accessToken
        };
      }

      case 'basic':
        return new BasicProvider({
          cache,
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
  }, [provider, loginUrl, refreshUrl]);

  const handleWindowFocus = useCallback(async () => {
    if (manager && manager.isAuthenticated) {
      const data = await manager.refreshDetails().catch(() => manager.logout());
      if (!data || data.errors) {
        manager.logout();
      } else {
        manager.setExpiration();
      }
    }
  }, [manager]);

  useEffect(() => {
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleWindowFocus]);

  if (manager) {
    manager.setCache = setCache;
    manager.clearCache = clearCache;
  }

  return { manager };
};

export default useAuth;
