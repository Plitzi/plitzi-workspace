// Packages
import { useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import { ParamsFromURL, emptyObject } from '@plitzi/sdk-shared/utils';

const useNavigation = (props = emptyObject) => {
  const { server = emptyObject } = props;
  const location = useMemo(
    () => (typeof window !== 'undefined' ? window.location : get(server, 'location', { pathname: '/' })),
    [server]
  );

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const hostname = useMemo(() => location.hostname ?? 'localhost', [location.hostname]);
  const navigationData = useMemo(() => ({ queryParams, hostname, location }), [queryParams, hostname, location]);

  return navigationData;
};

export default useNavigation;
