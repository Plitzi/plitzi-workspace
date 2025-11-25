import { Helmet } from '@dr.pogodin/react-helmet';
import get from 'lodash-es/get';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import SchemaPagesContext from '@modules/Schema/SchemaPagesContext';
import UserContext from '@plitzi/sdk-auth/UserContext';
import { pConsole } from '@plitzi/sdk-dev-tools/utils/PlitziConsole';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { NavigationStatus } from '@plitzi/sdk-navigation/NavigationContext';
import type { NavigationContextValue, RenderMode, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { PathMatch } from 'react-router-dom';

export type NavigationContextProviderProps = {
  children: ReactNode;
  renderMode?: RenderMode;
  currentPageId?: string;
  previewMode?: boolean;
};

const NavigationContextProvider = ({
  children,
  renderMode = 'iframe',
  currentPageId: currentPageIdProp,
  previewMode = true
}: NavigationContextProviderProps) => {
  const { server } = use(NetworkContext);
  const {
    schema: { pageFolders }
  } = use(SchemaContext);
  const { pageDefinitions, pages } = use(SchemaPagesContext);
  const { queryParams, hostname, location } = useNavigation({ server });
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(UserContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const navigate = renderMode !== 'widget' ? useNavigate() : undefined;

  const paths = useMemo(
    () => getPaths(pages, pageDefinitions, pageFolders, authenticated, server.basePath, previewMode),
    [pages, pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
  );

  const matchResult = useMemo<{
    action: { type: NavigationStatus; path?: string };
    pathMatch?: PathMatch;
    pageId?: string;
  }>(() => {
    if (renderMode === 'widget') {
      return { action: { type: 'normal', path: '' }, pageId: currentPageIdProp };
    }

    return matchRoutePath(paths, location.pathname, authenticated);
  }, [paths, location.pathname, authenticated, renderMode, currentPageIdProp]);

  const { action, pageId = '', pathMatch } = matchResult;
  const currentPageId = currentPageIdProp || pageId;

  useEffect(() => {
    pConsole.info(
      'navigation',
      <span>
        Navigated to page{' '}
        <b>
          {
            get(
              pageDefinitions,
              `${currentPageId}.attributes.name`,
              currentPageId ? currentPageId : 'Unknown'
            ) as string
          }
        </b>
      </span>,
      { status: action.type, elementId: currentPageId }
    );
  }, [action.type, currentPageId, pageDefinitions]);

  const handleNavigate = useCallback(
    (url: string, isExternal: boolean = false) => {
      if (isExternal && typeof window !== 'undefined') {
        window.location.href = url;

        return;
      }

      const page = get(pageDefinitionsRef, `current.${url}`, undefined);
      if (!page) {
        void navigate?.(url);

        return;
      }

      const slug = get(page, 'attributes.slug');
      if (slug || slug === '') {
        void navigate?.(slug);

        return;
      }

      const isHome = get(page, 'attributes.default');
      if (isHome) {
        void navigate?.('/');

        return;
      }

      void navigate?.(`/${url}`);
    },
    [navigate]
  );

  const routeParams = useMemo<RouteParams>(() => {
    const path = paths.find(path => path.pageId === currentPageId && !path.isRaw);
    if (!path) {
      return get(pathMatch, 'params', {}) as PathMatch['params'];
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...(get(pathMatch, 'params', {}) as PathMatch['params'])
    };
  }, [paths, pathMatch, currentPageId]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const navigationValue = useMemo<NavigationContextValue>(() => {
    if (renderMode === 'widget') {
      return { urlSearchParams, routeParams, queryParams, currentPageId } as NavigationContextValue;
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
  }, [renderMode, handleNavigate, urlSearchParams, routeParams, queryParams, hostname, currentPageId]);

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

  if (action.type === 'redirect') {
    return <Navigate to={action.path ?? ''} replace />;
  }

  return <NavigationContext value={navigationValue}>{children}</NavigationContext>;
};

export default NavigationContextProvider;
