// Packages
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import { ParamsFromURL } from '../../helpers/utils';
import NavigationContext from './NavigationContext';
import { matchRoutePath } from './NavigationHelper';

const NavigationSSR = props => {
  const { currentPageId: currentPageIdProp, server = emptyObject, paths = emptyObject, children } = props;
  const navigate = useNavigate();
  const { location } = server;

  const {
    pattern: { path },
    params
  } = useMemo(() => matchRoutePath(paths, location.pathname), [paths, location.pathname]);

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentPageId = currentPageIdProp || paths[path];

  useEffect(() => {
    if (path === '*' && location.pathname !== '/') {
      navigate(get(server, 'basePath', '/'));
    }
  }, [currentPageId, path]);

  const navigationValue = useMemo(
    () => ({ navigate, urlSearchParams, routeParams: params, queryParams, currentPageId }),
    [navigate, urlSearchParams, params, queryParams, currentPageId]
  );

  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
};

NavigationSSR.propTypes = {
  children: PropTypes.node,
  server: PropTypes.object,
  paths: PropTypes.object,
  currentPageId: PropTypes.string
};

export default NavigationSSR;
