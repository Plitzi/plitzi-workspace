import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStore, useRenderSettings, useBuilderStoreSync } from '@plitzi/sdk-shared/store';

import type { RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type NavigationProviderProps = {
  children?: ReactNode;
};

const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [[pageFolders, pageDefinitions, urlTest]] = useBuilderStore([
    'schema.pageFolders',
    'pageDefinitions',
    'urlTest'
  ]);
  const { previewMode } = useRenderSettings();
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
      return get(pathMatch, 'params', {});
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...get(pathMatch, 'params', {})
    };
  }, [paths, pathMatch, currentPageId]);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  /**
   * What the page is resolved against: the editor's own URL, with whatever the author is testing laid over it.
   *
   * Laid over rather than replacing, so a route param the author has not filled in still shows up empty (the page
   * knows it takes one) and every reader downstream — `when` rules, bindings, RSC, an action's input — sees ONE
   * answer. Publishing the override anywhere else would mean two, and the reader that picked the wrong one would
   * be right about a URL nobody is looking at.
   */
  const testedRouteParams = useMemo<RouteParams>(
    () => ({ ...routeParams, ...urlTest?.routeParams }),
    [routeParams, urlTest?.routeParams]
  );
  const testedQueryParams = useMemo(
    () => ({ ...queryParams, ...urlTest?.queryParams }),
    [queryParams, urlTest?.queryParams]
  );
  const testedSearchParams = useMemo(() => {
    if (!urlTest?.queryParams) {
      return urlSearchParams;
    }

    const params = new URLSearchParams(urlSearchParams);
    Object.entries(urlTest.queryParams).forEach(([key, value]) => params.set(key, String(value)));

    return params;
  }, [urlSearchParams, urlTest?.queryParams]);
  const testedHostname = urlTest?.hostname || hostname;

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

  useBuilderStoreSync(
    [
      'navigation.urlSearchParams',
      'navigation.routeParams',
      'navigation.queryParams',
      'navigation.hostname',
      'navigation.currentPageId',
      'navigation.navigate'
    ],
    [testedSearchParams, testedRouteParams, testedQueryParams, testedHostname, currentPageId ?? '', handleNavigate],
    { raw: true }
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
    <>
      {action.type === 'redirect' && action.path && <Navigate to={action.path} replace />}
      {children}
    </>
  );
};

export default NavigationProvider;
