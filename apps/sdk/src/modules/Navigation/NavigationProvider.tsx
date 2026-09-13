import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useStoreById } from '@plitzi/nexus/react';
import AuthContext from '@plitzi/sdk-auth/AuthContext';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { getPaths, matchRoutePath, getRouteParams } from '@plitzi/sdk-navigation/NavigationHelper';
import { resolveVariables } from '@plitzi/sdk-shared/dataSource';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { isAbsoluteUrl } from '@plitzi/sdk-shared/navigation';
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

/**
 * The page somebody actually asked for, absolute, so an off-origin sign-in can send them back to it.
 *
 * `href` is there in a browser and usually on the server's own location object too; the pieces are composed only
 * when it is not, because a redirect back to a URL missing its query string loses whatever the deep link carried.
 */
const currentUrl = (location: Location): string => {
  if (location.href) {
    return location.href;
  }

  const protocol = location.protocol || 'https:';

  return `${protocol}//${location.host || location.hostname}${location.pathname}${location.search}`;
};

const NavigationProvider = ({ children, currentPageId: currentPageIdProp }: NavigationProviderProps) => {
  const { server } = use(NetworkContext);
  // The root store, for the prefetch below: `refreshRsc` writes what it fetched where every element reads it.
  const store = useStoreById<CommonState>();
  const { renderMode, previewMode, environment } = useRenderSettings();
  const [[pageFolders, pageDefinitions, schemaVariables]] = useSdkStore([
    'schema.pageFolders',
    'pageDefinitions',
    'schema.variables'
  ]);
  // Written by reference during the SSR render and read back by the server to shape the response; undefined in the
  // browser, where the page has already been sent.
  const ssrResult = server.ssr?.renderResult;
  /**
   * The ROUTER's location, not the window's — for the same reason `navigate` is the router's.
   *
   * They are the same thing while a space owns the address bar, and they stop being the same the moment it does
   * not: a space embedded in an application with a router of its own routes in memory, so the window's address
   * never moves and matching the page against it left every internal link doing nothing at all.
   *
   * Guarded like `useNavigate` below: a widget render has no router to ask.
   */
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const routerLocation = renderMode !== 'widget' ? useLocation() : undefined;
  const { queryParams, hostname, origin, location } = useNavigation({ server, routerLocation });
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
      'navigation.origin',
      'navigation.currentPageId',
      'navigation.navigate'
    ],
    [urlSearchParams, routeParams, queryParams, hostname, origin, currentPageId, handleNavigate],
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
    /**
     * Off this origin entirely — a space whose sign-in lives somewhere else, which is what one shared sign-in
     * screen for a whole platform looks like from in here.
     *
     * It carries `redirect` so wherever it lands can send the visitor back to the page they actually asked for;
     * without it a deep link into a members area becomes "you are now signed in, on the home page".
     *
     * `<Navigate>` cannot do this: it is a ROUTER instruction, so it treats an absolute URL as a path and lands
     * on `/https:/auth.example.com`. A full-page assignment is the only thing that leaves this origin.
     */
    /**
     * Resolved against the space's variables FIRST, because a page attribute is not.
     *
     * `unauthorizedPageRedirect` is stored raw — nothing interpolates page attributes the way it interpolates a
     * step's params — so a space that writes `{{authUrl}}/` there redirected to the literal `/{{authUrl}}`. It is
     * written as a variable rather than a host precisely because the sign-in screen is at a different address in
     * every environment, which is the whole reason this field can name another origin at all.
     */
    /**
     * Resolved from `schema.variables`, NOT from the published `runtime.sources.variables`.
     *
     * The provider that publishes those is a CHILD of this one, and on this branch children never render at all —
     * deciding to redirect is deciding not to render the page. Reading the published map here therefore always saw
     * an empty object, and the redirect went to the literal `{{authUrl}}/`.
     */
    const variables = resolveVariables(schemaVariables, { queryParams, routeParams, hostname, environment });
    const resolved = action.path ? String(processTwig(action.path, { variables }, false, true)) : '';
    if (resolved && isAbsoluteUrl(resolved)) {
      const target = new URL(resolved);
      if (!target.searchParams.has('redirect')) {
        target.searchParams.set('redirect', currentUrl(location));
      }

      if (ssrResult) {
        ssrResult.redirect = target.toString();

        return null;
      }

      window.location.assign(target.toString());

      return null;
    }

    if (ssrResult) {
      ssrResult.redirect = action.path ?? '';

      return null;
    }

    return <Navigate to={action.path ?? ''} replace />;
  }

  return children;
};

export default NavigationProvider;
