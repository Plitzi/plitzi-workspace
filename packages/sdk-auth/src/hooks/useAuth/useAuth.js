// Packages
import { useMemo } from 'react';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Relatives
import BasicProvider from './managers/BasicProvider';

const useAuth = props => {
  const { provider, loginUrl, refreshUrl, detailsPath, tokenPath, expirationTimePath, webId = '' } = props;
  const [cache, setCache, , clearCache] = useCache({ cacheId: `user-${webId}-state`, skipContext: true });
  const manager = useMemo(() => {
    switch (provider) {
      // case 'auth0':
      //   return useAuth0();
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
