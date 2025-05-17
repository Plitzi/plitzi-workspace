import get from 'lodash/get';
import { useMemo } from 'react';

import { ParamsFromURL } from '@plitzi/sdk-shared/helpers/utils';

import type { Server } from '../types';

export type UseNavigationProps = {
  server: Server;
};

const useNavigation = ({ server }: UseNavigationProps) => {
  const location = useMemo<Location>(
    () => (typeof window !== 'undefined' ? window.location : get(server, 'location', { pathname: '/' } as Location)),
    [server]
  );

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const hostname = useMemo(() => (location.hostname ? location.hostname : 'localhost'), [location.hostname]);
  const navigationData = useMemo(() => ({ queryParams, hostname, location }), [queryParams, hostname, location]);

  return navigationData;
};

export default useNavigation;
