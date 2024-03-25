// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import { ParamsFromURL } from '../../helpers/utils';
import NavigationContext from './NavigationContext';
import { matchRoutePath } from './NavigationHelper';

const NavigationWidget = props => {
  const { currentPageId: currentPageIdProp, server = emptyObject, paths = emptyObject, children } = props;

  const location = useMemo(() => {
    if (typeof window === 'undefined') {
      return server.location;
    }

    return window.location;
  });

  const { params } = useMemo(() => matchRoutePath(paths, location.pathname), [paths, location.pathname]);

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentPageId = currentPageIdProp || paths['*'];

  const navigationValue = useMemo(
    () => ({ urlSearchParams, routeParams: params, queryParams, currentPageId }),
    [urlSearchParams, params, queryParams, currentPageId]
  );

  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
};

NavigationWidget.propTypes = {
  children: PropTypes.node,
  server: PropTypes.object,
  paths: PropTypes.object,
  currentPageId: PropTypes.string
};

export default NavigationWidget;
