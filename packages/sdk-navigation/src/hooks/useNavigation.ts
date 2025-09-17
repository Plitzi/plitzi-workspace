import get from 'lodash/get.js';
import { useMemo } from 'react';

import { ParamsFromURL } from '@plitzi/sdk-shared/helpers/utils';

import type { QueryParams, Server } from '@plitzi/sdk-shared';

export type UseNavigationProps = {
  server: Server;
};

const useNavigation = ({ server }: UseNavigationProps) => {
  const location = useMemo<Location>(
    () => (typeof window !== 'undefined' ? window.location : get(server, 'location', { pathname: '/' } as Location)),
    [server]
  );

  const queryParams = useMemo<QueryParams>(() => ParamsFromURL(location.search), [location.search]);
  const hostname = useMemo(() => (location.hostname ? location.hostname : 'localhost'), [location.hostname]);
  const navigationData = useMemo(() => ({ queryParams, hostname, location }), [queryParams, hostname, location]);

  return navigationData;
};

export default useNavigation;
