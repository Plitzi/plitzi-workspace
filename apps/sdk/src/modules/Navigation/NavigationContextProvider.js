// Packages
import React, { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import UserContext from '@plitzi/sdk-auth/UserContext';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { pConsole } from '@plitzi/sdk-dev-tools/PlitziConsole';

// Monorepo
import useNavigation from '@plitzi/sdk-navigation/useNavigation';

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
  const { queryParams, hostname, location } = useNavigation({ server });
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(UserContext);
  let navigate = noop;
  if (renderMode !== RENDER_MODE_WIDGET) {
    navigate = useNavigate();
  }

  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, server?.basePath, previewMode),
    [pages, pageFolders, authenticated, previewMode, server?.basePath]
  );

  const matchResult = useMemo(() => {
    if (renderMode === RENDER_MODE_WIDGET) {
      return { action: {}, pageId: currentPageIdProp };
    }

    return matchRoutePath(paths, location.pathname, authenticated);
  }, [paths, location.pathname, authenticated, renderMode, currentPageIdProp]);

  const { action, pageId, pathMatch } = matchResult;
  const currentPageId = currentPageIdProp || pageId;

  useEffect(() => {
    pConsole.info(
      'navigation',
      <span>
        Navigated to page <b>{get(pageDefinitions, `${currentPageId}.attributes.name`, currentPageId)}</b>
      </span>,
      { elementId: currentPageId }
    );
  }, [currentPageId]);

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
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const navigationValue = useMemo(() => {
    if (renderMode === RENDER_MODE_SSR) {
      return {
        navigate: handleNavigate,
        urlSearchParams,
        routeParams,
        queryParams,
        hostname,
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
      hostname,
      currentPageId,
      Helmet
    };
  }, [handleNavigate, urlSearchParams, routeParams, queryParams, currentPageId, Helmet]);

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

  return (
    <NavigationContext value={navigationValue}>
      {action?.type === 'redirect' && <Navigate to={action.path} replace />}
      {children}
    </NavigationContext>
  );
};

export default NavigationContextProvider;
