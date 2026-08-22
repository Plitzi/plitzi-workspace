import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useStoreById } from '@plitzi/nexus/react';
import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import refreshRsc from '@plitzi/sdk-shared/server/rsc/refreshRsc';
import { useSdkStore, useSdkStoreSync, useRenderSettings } from '@plitzi/sdk-shared/store';

import type { CommonState, Element, NavigationStatus, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { PathMatch } from 'react-router-dom';

export type NavigationProviderProps = {
  children: ReactNode;
  currentPageId?: string;
};

/** How long a navigation waits for the destination's data before going anyway. */
const PREFETCH_TIMEOUT_MS = 1500;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const NavigationProvider = ({ children, currentPageId: currentPageIdProp }: NavigationProviderProps) => {
  const { server } = use(NetworkContext);
  // The root store, for the prefetch below: `refreshRsc` writes what it fetched where every element reads it.
  const store = useStoreById<CommonState>();
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

  /**
   * Where a navigation actually goes.
   *
   * A caller may name a page id, a slug or a path, and the three are resolved here so that everything downstream —
   * the router, and the prefetch below — is talking about the same URL.
   */
  const resolveTarget = useCallback((url: string) => {
    const page: Element | undefined = get(pageDefinitionsRef, `current.${url}`, undefined);
    if (!page) {
      return url;
    }

    const { slug, default: isHome } = page.attributes as { slug?: string; default?: boolean };
    if (typeof slug === 'string') {
      return slug.startsWith('/') ? slug : `/${slug}`;
    }

    return isHome ? '/' : `/${url}`;
  }, []);

  const handleNavigate = useCallback(
    (url: string, isExternal: boolean = false) => {
      if (isExternal && typeof window !== 'undefined') {
        window.location.href = url;

        return;
      }

      const target = resolveTarget(url);

      /**
       * Ask for the destination's data BEFORE going there.
       *
       * A route change renders the new page immediately, and a page whose sections are resolved on the server has
       * no answer for them until an `/_rsc` round trip completes. Rendering first paints a page that contradicts
       * what is coming — an empty article, a link the visitor may not use — and then corrects itself, which is
       * exactly the flicker every SPA that fetches after routing has.
       *
       * `refreshRsc` answers immediately when there is nothing to fetch (no RSC, or a destination with no
       * server-driven element), so an ordinary page navigates as directly as it always did. The timeout is what
       * keeps a slow or dead endpoint from holding the visitor: past it the page goes anyway, and the provider
       * renders its loading state until the answer lands.
       */
      if (!store.get('rsc.enabled')) {
        void navigate?.(target);

        return;
      }

      const go = () => navigate?.(target);
      void Promise.race([refreshRsc(store, undefined, undefined, target), wait(PREFETCH_TIMEOUT_MS)]).then(go, go);
    },
    [navigate, resolveTarget, store]
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
