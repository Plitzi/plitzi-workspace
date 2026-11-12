import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import { useStoreById } from '@plitzi/nexus/react';
import { AuthContext } from '@plitzi/sdk-auth';
import { useNavigation, getPaths, matchRoutePath, getRouteParams, notFoundPageFor } from '@plitzi/sdk-navigation';
import { resolveVariables } from '@plitzi/sdk-shared/dataSource';
import { pConsole } from '@plitzi/sdk-shared/devTools';
import { flagValues, passesFlagGate, resolveFlags, flagUserFrom } from '@plitzi/sdk-shared/flags';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useStableValue } from '@plitzi/sdk-shared/hooks';
import { isAbsoluteUrl, navigationTarget } from '@plitzi/sdk-shared/navigation';
import { NetworkContext } from '@plitzi/sdk-shared/network/react';
import { pageWithheldOf } from '@plitzi/sdk-shared/schema';
import { refreshRsc } from '@plitzi/sdk-shared/server';
import { useSdkStore, useSdkStoreSync, useRenderSettings } from '@plitzi/sdk-shared/store';

import { currentUrl, offSiteTarget, returnTo, withRedirect } from './redirects';
import useScrollOnNavigation from './useScrollOnNavigation';
import useScrollToHash from './useScrollToHash';
import { browserHost, moveDrawn } from './viewTransition';
import { SpacePartsContext } from '../Network/spaceParts';

import type { RedirectedAs } from './redirects';
import type { CommonState, Element, NavigateHow, NavigationStatus, PageFolder, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { Location, NavigateFunction, NavigationType, PathMatch } from 'react-router-dom';

export type NavigationProviderProps = {
  children: ReactNode;
  currentPageId?: string;
};

/** What the router says of the address — absent in a widget render, which has no router to ask. */
type RouterState = { location: Location; navigationType: NavigationType; navigate: NavigateFunction };

/** How long a navigation waits for the destination's data before going anyway. */
const PREFETCH_TIMEOUT_MS = 1500;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * How long a navigation waits for the parts of the space its page needs (`spaceParts`) before it loads the address
 * from the server instead: a part is one small file, and past this the network is not going to bring it soon.
 */
const PARTS_TIMEOUT_MS = 10_000;

/** A page the document keeps from its visitor: withheld, drawn as a refusal, until the server is asked again. */
const keptFromVisitor = (page: Element | undefined): boolean => pageWithheldOf(page?.attributes) !== undefined;

/**
 * Whether the server was already asked for `here` for this visitor (`markServerAsked`): asked once, a page they truly
 * may not see is drawn as its refusal rather than loaded again and again. A browser that keeps nothing cannot tell a
 * second load from a first, so it is drawn as the document says.
 */
const serverAskedKey = (visitor: string | undefined, here: string): string =>
  `plitzi:visitor-load:${visitor ?? ''}:${here}`;

const serverAsked = (visitor: string | undefined, here: string): boolean => {
  try {
    return window.sessionStorage.getItem(serverAskedKey(visitor, here)) !== null;
  } catch {
    return true;
  }
};

const markServerAsked = (visitor: string | undefined, here: string): boolean => {
  try {
    window.sessionStorage.setItem(serverAskedKey(visitor, here), '1');

    return true;
  } catch {
    return false;
  }
};

/** A target's path alone, as a route is matched: no query, no fragment. */
const pathOf = (target: string): string => target.split(/[?#]/, 1)[0] || '/';

type RoutePaths = ReturnType<typeof getPaths>;

/**
 * The space's routes, kept per page definitions object (one per schema, `SchemaContextProvider`) and per how they are
 * read: the page server draws every request of a space from the same schema, and built them all again each time to
 * match one address.
 */
const routesByPages = new WeakMap<
  Record<string, Element>,
  Map<string, { pageFolders: PageFolder[] | undefined; paths: RoutePaths }>
>();

const routesOf = (
  pages: Record<string, Element>,
  pageFolders: PageFolder[] | undefined,
  authenticated: boolean | undefined,
  basePath: string | undefined,
  previewMode: boolean
): RoutePaths => {
  const kept =
    routesByPages.get(pages) ?? new Map<string, { pageFolders: PageFolder[] | undefined; paths: RoutePaths }>();
  routesByPages.set(pages, kept);
  const read = `${String(authenticated)}|${String(previewMode)}|${basePath ?? ''}`;
  const known = kept.get(read);
  if (known && known.pageFolders === pageFolders) {
    return known.paths;
  }

  const paths = getPaths(pages, pageFolders, authenticated, basePath, previewMode);
  kept.set(read, { pageFolders, paths });

  return paths;
};

const NavigationCore = ({
  children,
  currentPageId: currentPageIdProp,
  router
}: NavigationProviderProps & { router?: RouterState }) => {
  const { server } = use(NetworkContext);
  // The root store, for the prefetch below: `refreshRsc` writes what it fetched where every element reads it.
  const store = useStoreById<CommonState>();
  const { renderMode, previewMode, environment } = useRenderSettings();
  const [[pageFolders, pageDefinitions, schemaVariables, schemaFlags, flagOverrides]] = useSdkStore([
    'schema.pageFolders',
    'pageDefinitions',
    'schema.variables',
    'schema.flags',
    'flags.overrides'
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
   * Absent in a widget render, which has no router to ask (`NavigationProvider`).
   */
  const routerLocation = router?.location;
  // How it came there — a link, or back and forward — for the scroll it opens at.
  const navigationType = router?.navigationType;
  const { queryParams, hostname, origin, location } = useNavigation({ server, routerLocation });
  const pageDefinitionsRef = useRef(pageDefinitions);
  pageDefinitionsRef.current = pageDefinitions;
  const pageFoldersRef = useRef(pageFolders);
  pageFoldersRef.current = pageFolders;
  const { authenticated, signedOutHere, user, testAccount, state: authState, sessionChangedHere } = use(AuthContext);
  /**
   * Who this document was sent for: the visitor of the first settled session — the one the page server drew. A page
   * server sends a visitor only what is theirs (pages withheld, parts named `''`), so once somebody signs in or out on
   * the page (`sessionChangedHere`), what the document keeps from the visitor it was sent for is loaded from the server,
   * which sends this one theirs. A session settling as the page starts is no change; a test account of the dev tools is
   * no visitor of the server's.
   */
  const visitorNow =
    testAccount !== undefined
      ? undefined
      : authState === 'authenticated'
        ? String(user?.details?.id ?? 'signed-in')
        : authState === 'guest'
          ? ''
          : undefined;
  const documentVisitor = useRef<string | undefined>(undefined);
  if (documentVisitor.current === undefined && visitorNow !== undefined) {
    documentVisitor.current = visitorNow;
  }

  const visitorChanged =
    sessionChangedHere === true && visitorNow !== undefined && visitorNow !== documentVisitor.current;
  const visitorChangedRef = useRef(visitorChanged);
  visitorChangedRef.current = visitorChanged;
  const routerNavigate = router?.navigate;
  /**
   * The router's `navigate`, reached through a ref: it is a new function whenever the location changes, and the one
   * built on it below is published to the store, where every link on the page reads it. Depending on it made each
   * navigation re-render every link for a function that does the same thing.
   */
  const navigateRef = useRef(routerNavigate);
  useEffect(() => {
    navigateRef.current = routerNavigate;
  }, [routerNavigate]);

  const paths = useMemo(
    () => routesOf(pageDefinitions, pageFolders, authenticated, server.basePath, previewMode),
    [pageDefinitions, pageFolders, authenticated, server.basePath, previewMode]
  );
  const spaceParts = use(SpacePartsContext);
  /** The page a target opens, for what it needs before it is drawn — read when it is asked, not when it was made. */
  const pageAt = useRef<(target: string) => string | undefined>(() => undefined);
  pageAt.current = target => matchRoutePath(paths, pathOf(target), authenticated).pageId;
  /** A target loaded from the server: what a page whose parts cannot be had here does. */
  const loadFromServer = useCallback(
    (target: string) => {
      const base = (server.basePath ?? '/').replace(/\/+$/, '');
      window.location.assign(`${base}${target}`);
    },
    [server.basePath]
  );

  const matchResult = useMemo<{
    action: { type: NavigationStatus; path?: string };
    pathMatch?: PathMatch;
    pageId?: string;
    redirectedFrom?: string;
  }>(() => {
    // A widget names the element it draws. One that names none is a space drawn whole — a `plitziSdk` element, a
    // space inside a plugin — and with no address of its own it shows the page its home address would.
    if (renderMode === 'widget') {
      return {
        action: { type: 'normal', path: '' },
        pageId: currentPageIdProp || matchRoutePath(paths, '/', authenticated).pageId
      };
    }

    return matchRoutePath(paths, location.pathname, authenticated);
  }, [paths, location.pathname, authenticated, renderMode, currentPageIdProp]);

  const { action, pageId = '', pathMatch, redirectedFrom } = matchResult;
  const currentPageId = currentPageIdProp || pageId;
  useScrollToHash({
    hash: routerLocation?.hash ?? '',
    navigationKey: routerLocation?.key,
    enabled: previewMode && renderMode !== 'widget'
  });
  useScrollOnNavigation({
    pathname: routerLocation?.pathname ?? '',
    hash: routerLocation?.hash ?? '',
    ...(routerLocation === undefined ? {} : { navigationKey: routerLocation.key }),
    ...(navigationType === undefined ? {} : { action: navigationType }),
    enabled: previewMode && renderMode !== 'widget'
  });

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
  const resolveTarget = useCallback(
    (url: string) => navigationTarget(pageDefinitionsRef.current, pageFoldersRef.current, url),
    []
  );

  /** Which navigation is the latest: only it goes anywhere, and only it says where the page is going. */
  const latestNavigation = useRef(0);

  /**
   * The router's move, drawn as a view transition when the space asks for one (`moveDrawn`): it ends once the new
   * location is laid out, said here.
   */
  const drawn = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    drawn.current?.();
    drawn.current = undefined;
  }, [location.pathname, location.search]);
  const goTo = useCallback(
    (target: string, replace: boolean) =>
      moveDrawn(() => void navigateRef.current?.(target, { replace }), {
        asked: store.get('schema.settings.viewTransitions'),
        host: browserHost(),
        drawn
      }),
    [store]
  );

  const handleNavigate = useCallback(
    (url: string, { external = false, replace = false }: NavigateHow = {}) => {
      if (external && typeof window !== 'undefined') {
        if (replace) {
          window.location.replace(url);
        } else {
          window.location.href = url;
        }

        return;
      }

      const target = resolveTarget(url);
      const ticket = ++latestNavigation.current;
      const pageId = pageAt.current(target);
      const need = pageId ? spaceParts.need(pageId) : 'held';
      if (pageId && visitorChangedRef.current && keptFromVisitor(pageDefinitionsRef.current[pageId])) {
        loadFromServer(target);

        return;
      }

      if (need === 'server') {
        loadFromServer(target);

        return;
      }

      if (pageId && need === 'fetch') {
        store.set('navigation.pendingLocation', target);
        const timedOut = wait(PARTS_TIMEOUT_MS).then(() => {
          throw new Error(`they did not arrive in ${String(PARTS_TIMEOUT_MS / 1000)} s`);
        });
        Promise.race([spaceParts.ensure(pageId), timedOut]).then(
          drawable => {
            if (latestNavigation.current !== ticket) {
              return;
            }

            if (drawable) {
              handleNavigate(url, { replace });
            } else {
              loadFromServer(target);
            }
          },
          (error: unknown) => {
            pConsole.warning(
              'navigation',
              `The page at ${target} is loaded from the server: its part of the space could not be fetched (${error instanceof Error ? error.message : String(error)})`,
              { status: 'warning', elementId: pageId }
            );
            if (latestNavigation.current === ticket) {
              loadFromServer(target);
            }
          }
        );

        return;
      }

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
       *
       * A second navigation before the first went supersedes it: its prefetch aborts the first one's, and the first
       * one never goes — clicking A and then B used to pass through A on the way.
       */
      if (!store.get('rsc.enabled')) {
        store.set('navigation.pendingLocation', '');
        goTo(target, replace);

        return;
      }

      store.set('navigation.pendingLocation', target);
      const prefetch = refreshRsc(store, undefined, undefined, { location: target }).finally(() => {
        if (latestNavigation.current === ticket) {
          store.set('navigation.pendingLocation', '');
        }
      });
      const go = () => {
        if (latestNavigation.current === ticket) {
          goTo(target, replace);
        }
      };
      void Promise.race([prefetch, wait(PREFETCH_TIMEOUT_MS)]).then(go, go);
    },
    [goTo, loadFromServer, resolveTarget, spaceParts, store]
  );

  /**
   * A link about to be followed — on screen — gets its page's parts of the space before it is (`navigation.prefetch`), so
   * the navigation finds them held. One that fails is asked again by the navigation, which says why if it fails there.
   */
  const handlePrefetch = useCallback(
    (url: string) => {
      if (isAbsoluteUrl(url)) {
        return;
      }

      const pageId = pageAt.current(resolveTarget(url));
      if (pageId && spaceParts.need(pageId) === 'fetch') {
        spaceParts.ensure(pageId).catch(() => undefined);
      }
    },
    [resolveTarget, spaceParts]
  );

  const routeParamsValue = useMemo<RouteParams>(() => {
    const path = paths.find(path => path.pageId === currentPageId && !path.isRaw);
    if (!path) {
      return get(pathMatch, 'params', {});
    }

    return {
      ...getRouteParams(path.path).reduce((acum, param) => ({ ...acum, [param]: '' }), {}),
      ...get(pathMatch, 'params', {})
    };
  }, [paths, pathMatch, currentPageId]);
  // Rebuilt on every navigation; published as they come, every reader rendered again for params that had not changed.
  const routeParams = useStableValue(routeParamsValue);
  const stableQueryParams = useStableValue(queryParams);
  const urlSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const href = origin ? `${origin}${location.pathname}${location.search}` : '';

  /**
   * A page gated on a flag that says no is a page that does not exist — the same answer, status included, as a URL
   * nothing matches.
   *
   * Resolved here rather than read from the `flags` source, for the reason the variables below are: that source is
   * published by a child of this provider, and this is where it is decided whether any child renders. With the same
   * values that source is about to be given, so the two answer alike.
   */
  const pageGate = Object.hasOwn(pageDefinitions, currentPageId)
    ? pageDefinitions[currentPageId].definition.flag
    : undefined;
  const pageGatedOff =
    pageGate !== undefined &&
    !passesFlagGate(
      pageGate,
      flagValues(
        resolveFlags(
          schemaFlags,
          {
            environment,
            hostname,
            routeParams,
            queryParams: stableQueryParams,
            user: flagUserFrom({ authenticated, user })
          },
          flagOverrides
        )
      )
    );

  // What is shown for a page gated off is the space's "not found" page for its address, as for one nothing matches.
  const shownPageId = pageGatedOff ? (notFoundPageFor(paths, location.pathname) ?? '') : currentPageId;

  /**
   * A page this document kept from the visitor it was sent for redirects to signing in — and the visitor has signed in
   * since: what it says is no longer theirs, so it is neither followed nor drawn, and the server is asked for the page.
   */
  const heldForServer =
    visitorChanged &&
    action.type === 'redirect' &&
    redirectedFrom !== undefined &&
    keptFromVisitor(pageDefinitions[redirectedFrom]);

  /**
   * The page on screen without its parts of the space — the router changed to it with no navigation, as one page at an
   * address gives way to another when somebody signs in: fetched here, and loaded from the server if they do not come.
   * A navigation fetches them before it goes; this is for what does not navigate.
   */
  const [, setPartsArrived] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !shownPageId || spaceParts.need(shownPageId) !== 'fetch') {
      return;
    }

    const here = `${location.pathname}${location.search}${location.hash}`;
    spaceParts.ensure(shownPageId).then(
      drawable => {
        if (drawable) {
          // The page was held back for them (below): drawn now, its elements mounting with what they need.
          setPartsArrived(turn => turn + 1);
        } else {
          loadFromServer(here);
        }
      },
      (error: unknown) => {
        pConsole.warning(
          'navigation',
          `The page at ${here} is loaded from the server: its part of the space could not be fetched (${error instanceof Error ? error.message : String(error)})`,
          { status: 'warning', elementId: shownPageId }
        );
        loadFromServer(here);
      }
    );
  }, [shownPageId, spaceParts, location, loadFromServer]);

  /**
   * The page on screen, once somebody signed in or out here, when the document keeps it from whoever it was sent for —
   * withheld, or a part only the server draws: loaded from the server, which sends this visitor theirs. Once per visitor
   * and address, so a page they truly may not see is drawn as its refusal rather than loaded again and again.
   */
  useEffect(() => {
    if (!visitorChanged || typeof window === 'undefined') {
      return;
    }

    if (!heldForServer && !keptFromVisitor(pageDefinitions[shownPageId]) && spaceParts.need(shownPageId) !== 'server') {
      return;
    }

    const here = `${location.pathname}${location.search}${location.hash}`;
    if (serverAsked(visitorNow, here) || !markServerAsked(visitorNow, here)) {
      return;
    }

    loadFromServer(here);
  }, [visitorChanged, visitorNow, heldForServer, shownPageId, pageDefinitions, spaceParts, location, loadFromServer]);

  useSdkStoreSync(
    [
      'navigation.urlSearchParams',
      'navigation.routeParams',
      'navigation.queryParams',
      'navigation.hostname',
      'navigation.origin',
      'navigation.href',
      'navigation.currentPageId',
      'navigation.navigate',
      'navigation.prefetch'
    ],
    [
      urlSearchParams,
      routeParams,
      stableQueryParams,
      hostname,
      origin,
      href,
      shownPageId,
      handleNavigate,
      handlePrefetch
    ],
    { raw: true }
  );

  // A page whose parts of the space are on their way is not drawn without them: elements mounted with nothing to draw
  // do not come back for what arrives after.
  if (typeof window !== 'undefined' && shownPageId && spaceParts.need(shownPageId) === 'fetch') {
    return null;
  }

  if (action.type === 'notFound' || pageGatedOff) {
    if (ssrResult) {
      ssrResult.status = 404;
    }

    // The space's own "not found" page — a page whose slug is `*` — or, in a space that declares none, the words.
    return shownPageId ? children : 'Not Found';
  }

  if (action.type === 'accessDenied') {
    if (ssrResult) {
      ssrResult.status = 403;
    }

    return 'Access Denied';
  }

  if (heldForServer && !serverAsked(visitorNow, `${location.pathname}${location.search}${location.hash}`)) {
    return null;
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
    const redirectedAs: RedirectedAs = authenticated ? 'signedIn' : signedOutHere ? 'signedOutHere' : 'signedOut';
    const variables = resolveVariables(schemaVariables, { queryParams, routeParams, hostname, environment });
    const resolved = action.path ? String(processTwig(action.path, { variables }, false, true)) : '';
    if (resolved && isAbsoluteUrl(resolved)) {
      // A journey's test account holds no session the server knows: the site it would be sent to judges by that
      // session, and would only send it back. The page stays, and the journey moves on from it.
      if (testAccount !== undefined) {
        return children;
      }

      const target = offSiteTarget(resolved, location, redirectedAs);
      if (ssrResult) {
        ssrResult.redirect = target;

        return null;
      }

      window.location.assign(target);

      return null;
    }

    // A sign-in of this space is told where the visitor was going too, the whole address as one elsewhere is: a run's
    // guest sent to `/sign-in` was signed in on the home page. A signed-in visitor sent off a signed-out page goes
    // back where that address says, when it says — signing in on the sign-in is what sends them off it. One who signed
    // out on the page is told nowhere, as off the site.
    const onSite =
      action.path && redirectedAs === 'signedOut'
        ? withRedirect(action.path, currentUrl(location))
        : ((authenticated ? returnTo(location) : undefined) ?? action.path ?? '');
    if (ssrResult) {
      ssrResult.redirect = onSite;

      return null;
    }

    return <Navigate to={onSite} replace />;
  }

  return children;
};

/** Inside a router: what it says of the address, read on every render and handed to the navigation. */
const RoutedNavigation = (props: NavigationProviderProps) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();

  return <NavigationCore {...props} router={{ location, navigationType, navigate }} />;
};

/**
 * The space's navigation. A widget render has no router — it draws one element, or a space inside another — so it
 * navigates without one; every other render reads the router it is mounted in. The mode is fixed for a render's life,
 * so neither branch is ever swapped for the other under the same tree.
 */
const NavigationProvider = (props: NavigationProviderProps) => {
  const { renderMode } = useRenderSettings();

  return renderMode === 'widget' ? <NavigationCore {...props} /> : <RoutedNavigation {...props} />;
};

export default NavigationProvider;
