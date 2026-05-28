import { Helmet } from '@dr.pogodin/react-helmet';
import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import type {
  BuilderState,
  NavigationContextValue,
  NavigationStatus,
  RenderMode,
  RouteParams
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { PathMatch } from 'react-router-dom';

export type NavigationContextProviderProps = {
  children: ReactNode;
  renderMode?: RenderMode;
  currentPageId?: string;
  previewMode?: boolean;
};

type MatchResult = {
  action: { type: NavigationStatus; path?: string };
  pathMatch?: PathMatch;
  pageId?: string;
};

const NavigationContextProviderWidget = ({
  children,
  currentPageId: currentPageIdProp,
  previewMode = true
}: NavigationContextProviderProps) => {
  const { server } = use(NetworkContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageFolders, pageDefinitions]] = useStore(['schema.pageFolders', 'pageDefinitions']);
  const { queryParams } = useNavigation({ server });
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(AuthContext);

  const paths = useMemo(
    () => getPaths(pageDefinitions, pageFolders, authenticated, server.basePath, previewMode),
    [pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
  );

  const currentPageId = currentPageIdProp ?? '';
  const action = { type: 'normal' as const, path: '' };

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

  const routeParams = useMemo<RouteParams>(() => {
    const path = paths.find(path => path.pageId === currentPageId && !path.isRaw);
    if (!path) {
      return {};
    }

    return getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {});
  }, [paths, currentPageId]);
  const urlSearchParams = useMemo(() => new URLSearchParams(''), []);
  const navigationValue = useMemo<NavigationContextValue>(
    () => ({ urlSearchParams, routeParams, queryParams, currentPageId }) as NavigationContextValue,
    [urlSearchParams, routeParams, queryParams, currentPageId]
  );

  return <NavigationContext value={navigationValue}>{children}</NavigationContext>;
};

const NavigationContextProviderRouted = ({
  children,
  currentPageId: currentPageIdProp,
  previewMode = true
}: NavigationContextProviderProps) => {
  const { server } = use(NetworkContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageFolders, pageDefinitions]] = useStore(['schema.pageFolders', 'pageDefinitions']);
  const { queryParams, hostname } = useNavigation({ server });
  const { pathname, search } = useLocation();
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const { authenticated } = use(AuthContext);
  const navigate = useNavigate();

  const paths = useMemo(
    () => getPaths(pageDefinitions, pageFolders, authenticated, server.basePath, previewMode),
    [pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
  );

  const matchResult = useMemo<MatchResult>(
    () => matchRoutePath(paths, pathname, authenticated),
    [paths, pathname, authenticated]
  );

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
        void navigate(url);

        return;
      }

      const slug = get(page, 'attributes.slug');
      if (slug || slug === '') {
        void navigate(slug);

        return;
      }

      const isHome = get(page, 'attributes.default');
      if (isHome) {
        void navigate('/');

        return;
      }

      void navigate(`/${url}`);
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
  const urlSearchParams = useMemo(() => new URLSearchParams(search), [search]);
  const navigationValue = useMemo<NavigationContextValue>(
    () => ({
      navigate: handleNavigate,
      urlSearchParams,
      routeParams,
      queryParams,
      hostname,
      currentPageId,
      Helmet
    }),
    [handleNavigate, urlSearchParams, routeParams, queryParams, hostname, currentPageId]
  );

  if (action.type === 'notFound') {
    return 'Not Found';
  }

  if (action.type === 'accessDenied') {
    return 'Access Denied';
  }

  if (action.type === 'redirect') {
    return <Navigate to={action.path ?? ''} replace />;
  }

  return <NavigationContext value={navigationValue}>{children}</NavigationContext>;
};

const NavigationContextProvider = (props: NavigationContextProviderProps) => {
  if (props.renderMode === 'widget') {
    return <NavigationContextProviderWidget {...props} />;
  }

  return <NavigationContextProviderRouted {...props} />;
};

export default NavigationContextProvider;
