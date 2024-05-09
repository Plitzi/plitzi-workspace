// Packages
import React, { useCallback, use, useMemo, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import get from 'lodash/get';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import UserContext from '@plitzi/sdk-auth/UserContext';
import { ParamsFromURL } from '@plitzi/sdk-shared/utils';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import { RENDER_MODE_IFRAME, RENDER_MODE_SSR, RENDER_MODE_WIDGET } from '@modules/Sdk/Sdk';
import NetworkContext from '@modules/Network/NetworkContext';
import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';

// Relatives

/**
 * @param {{
 *   children: React.ReactNode;
 *   renderMode?: 'iframe' | 'ssr' | 'widget';
 *   currentPageId?: string;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const NavigationContextProvider = props => {
  const { children, renderMode = RENDER_MODE_IFRAME, currentPageId: currentPageIdProp, previewMode = true } = props;
  const { server } = use(NetworkContext);
  const {
    schema: { pageFolders }
  } = use(SchemaContext);
  const { pageDefinitions, pages } = use(SchemaPagesContext);
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(UserContext);
  const navigate = useNavigate();
  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, previewMode),
    [pages, pageFolders, authenticated, previewMode]
  );

  const location = useMemo(
    () => (typeof window !== 'undefined' ? window.location : get(server, 'location', { pathname: '/' })),
    [server]
  );

  const matchResult = useMemo(
    () => matchRoutePath(paths, location.pathname, authenticated, renderMode === RENDER_MODE_WIDGET ? '*' : ''),
    [paths, location.pathname, authenticated]
  );

  const { action, pageId, pathMatch } = matchResult;
  const currentPageId = currentPageIdProp || pageId;

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

  const routeParams = useMemo(() => {
    const path = paths.find(path => path.pageId === currentPageId && !path.isRaw);
    if (!path) {
      return get(pathMatch, 'params', {});
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...get(pathMatch, 'params', {})
    };
  }, [paths, pathMatch]);
  const queryParams = useMemo(() => ParamsFromURL(location.search), [location.search]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const navigationValue = useMemo(() => {
    if (renderMode === RENDER_MODE_SSR) {
      return {
        navigate: handleNavigate,
        urlSearchParams,
        routeParams,
        queryParams,
        currentPageId
      };
    }

    if (renderMode === RENDER_MODE_WIDGET) {
      return { urlSearchParams, routeParams, queryParams, currentPageId };
    }

    return {
      navigate: handleNavigate,
      urlSearchParams,
      routeParams,
      queryParams,
      currentPageId,
      Helmet
    };
  }, [handleNavigate, urlSearchParams, routeParams, queryParams, currentPageId, Helmet]);

  if (action.type === 'redirect') {
    return <Navigate to={action.path} replace />;
  }

  if (action.type === 'notFound') {
    // @todo: In the future this should navigate to page 404
    // return <Navigate to="/not-found" replace />;
    return 'Not Found';
  }

  if (action.type === 'accessDenied') {
    // @todo: In the future this should navigate to page 403
    // return <Navigate to="/unauthorized" replace />;
    return 'Access Denied';
  }

  if (!currentPageId) {
    // Rare scenario where pages are incorrectly configured and no default page is found
    return 'Page Not Found';
  }

  return <NavigationContext value={navigationValue}>{children}</NavigationContext>;
};

export default NavigationContextProvider;
