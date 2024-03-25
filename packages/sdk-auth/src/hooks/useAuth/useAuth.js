// Packages
import { useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Relatives
import BasicProvider from './managers/BasicProvider';

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
        return null;
    }
  }, [provider, loginUrl, refreshUrl]);

  return { manager };
};

export default useAuth;
