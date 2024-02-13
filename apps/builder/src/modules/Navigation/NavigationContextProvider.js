// Packages
import React, { useMemo, useContext, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import get from 'lodash/get';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import UserContext from '@pmodules/User/UserContext';

// Relatives
import { ParamsFromURL } from '../../helpers/utils';
import NavigationContext from './NavigationContext';
import { getPaths, matchRoutePath } from './NavigationHelper';

const NavigationContextProvider = props => {
  const { previewMode = false, children } = props;
  const { server } = useContext(NetworkContext);
  const { pages, pageDefinitions, pageFolders } = useContext(SchemaMainContext);
  const { authenticated } = useContext(UserContext);
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;

  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, previewMode),
    [pages, pageFolders, authenticated, previewMode]
  );

  const {
    pattern: { path },
    params
  } = useMemo(() => matchRoutePath(paths, location.pathname), [paths, location.pathname]);

  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentPageId = paths[path];

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
  }, [pages, currentPageId, path]);

  const navigationValue = useMemo(
    () => ({ navigate: handleNavigate, urlSearchParams, routeParams: params, queryParams, currentPageId }),
    [handleNavigate, urlSearchParams, params, queryParams, currentPageId, location, navigationType]
  );

  return <NavigationContext.Provider value={navigationValue}>{children}</NavigationContext.Provider>;
};

NavigationContextProvider.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool
};

export default NavigationContextProvider;
