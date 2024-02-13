// Packages
import React, { useMemo, useContext, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import get from 'lodash/get';
import { Helmet } from 'react-helmet-async';

// Alias
import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';

// Relatives
import { ParamsFromURL, emptyObject } from '../../helpers/utils';
import NavigationContext from './NavigationContext';
import { matchRoutePath } from './NavigationHelper';

const NavigationNormal = props => {
  const { currentPageId: currentPageIdProp, server = emptyObject, paths = emptyObject, children } = props;
  const { pageDefinitions } = useContext(SchemaPagesContext);
  const navigate = useNavigate();
  const location = useLocation();
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;

  const {
    pattern: { path },
    params
  } = useMemo(() => matchRoutePath(paths, location.pathname), [paths, location.pathname]);

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentPageId = currentPageIdProp || paths[path];

  const handleNavigate = useCallback(
    (url, isExternal) => {
      if (isExternal && typeof window !== 'undefined') {
        window.location.href = url;

        return;
      }

      const page = get(pageDefinitionsRef, `current.${url}`);
      if (!page) {
        navigate(url);

        return;
      }

      const slug = get(page, 'attributes.slug');
      if (slug || slug === '') {
        navigate(slug);

        return;
      }

      const isHome = get(page, 'attributes.default');
      if (isHome) {
        navigate('/');

        return;
      }

      navigate(`/${url}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (path === '*' && location.pathname !== '/') {
      navigate(get(server, 'basePath', '/'));
    }
  }, [currentPageId, path]);

  const navigationValue = useMemo(
    () => ({ navigate: handleNavigate, urlSearchParams, routeParams: params, queryParams, currentPageId, Helmet }),
    [handleNavigate, urlSearchParams, params, queryParams, currentPageId, Helmet]
  );

  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
};

NavigationNormal.propTypes = {
  children: PropTypes.node,
  server: PropTypes.object,
  paths: PropTypes.object,
  currentPageId: PropTypes.string
};

export default NavigationNormal;
