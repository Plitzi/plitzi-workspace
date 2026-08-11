import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useSdkStore, useSdkStoreSync, useRenderSettings } from '@plitzi/sdk-shared/store';

import type { NavigationStatus, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { PathMatch } from 'react-router-dom';

export type NavigationProviderProps = {
  children: ReactNode;
  currentPageId?: string;
};

const NavigationProvider = ({ children, currentPageId: currentPageIdProp }: NavigationProviderProps) => {
  const { server } = use(NetworkContext);
  const { renderMode, previewMode } = useRenderSettings();
  const [[pageFolders, pageDefinitions]] = useSdkStore(['schema.pageFolders', 'pageDefinitions']);
  // Written by reference during the SSR render and read back by the server to shape the response; undefined in the
  // browser, where the page has already been sent.
  const ssrResult = server.ssr?.renderResult;
  const { queryParams, hostname, location } = useNavigation({ server });
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(AuthContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const navigate = renderMode !== 'widget' ? useNavigate() : undefined;

  const paths = useMemo(
    () => getPaths(pageDefinitions, pageFolders, authenticated, server.basePath, previewMode),
    [pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
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
        <b>{get(pageDefinitions, `${currentPageId}.attributes.name`, currentPageId ? currentPageId : 'Unknown')}</b>
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
      return get(pathMatch, 'params', {});
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...get(pathMatch, 'params', {})
    };
  }, [paths, pathMatch, currentPageId]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useSdkStoreSync(
    [
      'navigation.urlSearchParams',
      'navigation.routeParams',
      'navigation.queryParams',
      'navigation.hostname',
      'navigation.currentPageId',
      'navigation.navigate'
    ],
    [urlSearchParams, routeParams, queryParams, hostname, currentPageId, handleNavigate],
    { raw: true }
  );

  if (action.type === 'notFound') {
    // @todo: In the future this should navigate to page 404
    // return <Navigate to="/not-found" replace />;
    if (ssrResult) {
      ssrResult.status = 404;
    }

    return 'Not Found';
  }

  if (action.type === 'accessDenied') {
    // @todo: In the future this should navigate to page 403
    // return <Navigate to="/unauthorized" replace />;
    if (ssrResult) {
      ssrResult.status = 403;
    }

    return 'Access Denied';
  }

  if (action.type === 'redirect') {
    if (ssrResult) {
      ssrResult.redirect = action.path ?? '';

      return null;
    }

    return <Navigate to={action.path ?? ''} replace />;
  }

  return children;
};

export default NavigationProvider;
