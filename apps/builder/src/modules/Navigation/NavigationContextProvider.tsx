import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import type { BuilderState, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { PathMatch } from 'react-router-dom';

export type NavigationContextProviderProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const NavigationContextProvider = ({ previewMode = false, children }: NavigationContextProviderProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageFolders, pageDefinitions]] = useStore(['schema.pageFolders', 'pageDefinitions']);
  const { server } = use(NetworkContext);
  const { authenticated } = use(AuthContext);
  const { queryParams, hostname, location } = useNavigation({ server });
  const navigate = useNavigate();
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;

  const paths = useMemo(
    () => getPaths(pageDefinitions, pageFolders, previewMode ? undefined : authenticated, server.basePath, previewMode),
    [pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
  );

  const matchResult = useMemo(
    () => matchRoutePath(paths, location.pathname, authenticated),
    [paths, location.pathname, authenticated]
  );

  const { action, pageId: currentPageId, pathMatch } = matchResult;

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

  const handleNavigate = useCallback(
    (url: string, isExternal: boolean = false) => {
      if (isExternal && typeof window !== 'undefined') {
        window.location.href = url;

        return;
      }

      const page = get(pageDefinitionsRef, `current.${url}`, undefined);
      if (!page) {
        void navigate(url);

        return;
      }

      const slug = get(page, 'attributes.slug', '') as string;
      if (slug || slug === '') {
        void navigate(slug);

        return;
      }

      const isHome = get(page, 'attributes.default', false) as boolean;
      if (isHome) {
        void navigate('/');

        return;
      }

      void navigate(`/${url}`);
    },
    [navigate]
  );

  const navigationValue = useMemo(
    () => ({
      navigate: handleNavigate,
      urlSearchParams,
      routeParams,
      queryParams,
      hostname,
      currentPageId: currentPageId ?? ''
    }),
    [handleNavigate, urlSearchParams, routeParams, queryParams, hostname, currentPageId]
  );

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
      {action.type === 'redirect' && action.path && <Navigate to={action.path} replace />}
      {children}
    </NavigationContext>
  );
};

export default NavigationContextProvider;
