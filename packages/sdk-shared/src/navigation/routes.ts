import { matchPath } from './matchPath';

import type { PathMatch } from './matchPath';
import type { Element, PageFolder } from '../types';

export type NavigationAction = 'accessDenied' | 'normal' | 'redirect' | 'notFound';

export type NavigationAccessLevel = 'public' | 'authenticated';

export type Path = {
  accessLevel?: NavigationAccessLevel;
  enabled?: boolean;
  hasAccess: boolean;
  isRaw: boolean;
  pageId: string;
  path: string;
  unauthorizedBehaviour?: NavigationAction;
  unauthorizedPageRedirect?: string;
  /**
   * A path of the space's "not found" page — a page whose slug is `*`, the page of every address under its folder that
   * no other page answers — sent with status 404. Not every path ending in `*`: `update/*` is a page of its own that
   * answers a whole subtree.
   */
  notFound?: true;
};

type PageAttributes = {
  slug?: string;
  folder: string;
  default: boolean;
};

/**
 * Does this name another origin, rather than somewhere in this space?
 *
 * Deliberately narrow: `//host` and a bare `host.com` are NOT absolute here. The first is protocol-relative and
 * reads as a path to anybody skimming, and the second is indistinguishable from a page slug — treating either as
 * external would turn a typo into an off-site redirect.
 */
export const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

/** The slug of the space's "not found" page: the page of every address under its folder that no other page answers. */
export const NOT_FOUND_SLUG = '*';

/**
 * Is this a destination outside this space — either already absolute, or a token that will resolve to one?
 *
 * The token half matters because the address of an off-site sign-in differs per environment, so a space writes it
 * as `{{authUrl}}/` and not as a host. Page ATTRIBUTES are never interpolated (only a step's params are), so the
 * token is still there when the route table is built — and running it through the page resolver turned
 * `{{authUrl}}/` into `/{{authUrl}}`, a path inside this space, before anything had a chance to resolve it.
 */
const isOffSite = (url: string): boolean => isAbsoluteUrl(url) || url.includes('{{');

/**
 * A run of slashes is one: a slug or folder written with one too many would otherwise build `//play`, which is a
 * protocol-relative URL and quietly navigates nowhere.
 */
const collapseSlashes = (path: string) => path.replaceAll(/\/+/g, '/');

/**
 * A route-table key: every `{{param}}` becomes the router's `:param`, which only the table reads. Every one — a slug
 * with two (`blog/{{year}}/{{slug}}`) kept its second as literal text, and no address could ever match the page.
 */
const parsePath = (path: string) => collapseSlashes(path.replace(/{{([a-zA-Z0-9-_:*/]+)}}/gi, ':$1'));

const recursiveFolderSlug = (pageFolders: Record<string, PageFolder | undefined>, pageFolderId: string): string => {
  if (!pageFolderId || !pageFolders[pageFolderId]) {
    return '';
  }

  const pageFolder = pageFolders[pageFolderId];
  const { slug, parentId } = pageFolder;
  if (!parentId) {
    return slug;
  }

  return `${recursiveFolderSlug(pageFolders, parentId)}/${slug}`;
};

function getPageFullPath(
  pages: Record<string, Element>,
  pageFolders: PageFolder[],
  pageId: string,
  asString: true
): string;
function getPageFullPath(
  pages: Record<string, Element>,
  pageFolders: PageFolder[],
  pageId: string,
  asString?: false
): Record<string, string>;
function getPageFullPath(
  pages: Record<string, Element>,
  pageFolders: PageFolder[],
  pageId: string,
  asString: boolean = false
): string | Record<string, string> {
  // A page id never starts with a slash, but a habit writes the page's path, `/play`, where its id goes.
  const id = pageId.replace(/^\/+/, '');
  const {
    slug: pageSlug = '',
    folder: folderId,
    default: defaultPage
  } = ((pages[id] as Element | undefined)?.attributes ?? {
    slug: id,
    folder: '',
    default: false
  }) as PageAttributes;
  if (defaultPage && !asString) {
    return { '/': pageId, [`/${pageId}`]: pageId }; // '*': pageId
  }

  if (defaultPage && asString) {
    return '/';
  }

  if (!folderId && !asString) {
    return { [parsePath(`/${pageSlug}`)]: pageId, [parsePath(`/${pageId}`)]: pageId };
  }

  if (!folderId && asString) {
    return collapseSlashes(`/${pageSlug}`);
  }

  const pageFolder = pageFolders.find((pageFolder: PageFolder) => pageFolder.id === folderId);
  if (!pageFolder) {
    return asString
      ? collapseSlashes(`/${pageSlug}`)
      : { [parsePath(`/${pageSlug}`)]: pageId, [parsePath(`/${pageId}`)]: pageId };
  }

  const pageFoldersObj = pageFolders.reduce((acum, pageFolder) => ({ ...acum, [pageFolder.id]: pageFolder }), {});
  // An empty slug is the folder's own address, as it is the space's at the top level: `/analytics` is the page with no
  // slug inside the `analytics` folder, the way `/` is the page with none outside any.
  const path = [recursiveFolderSlug(pageFoldersObj, folderId), pageSlug].filter(Boolean).join('/');
  if (asString) {
    return collapseSlashes(`/${path}`);
  }

  return { [parsePath(`/${path}`)]: pageId, [parsePath(`/${pageId}`)]: pageId };
}

/**
 * Where a navigation to `target` goes: a page id resolves to that page's full path — its folders' slugs before its own,
 * exactly what a link to it resolves to — and anything else (a path, a slug) is taken as the path it already is.
 *
 * The router's navigation and a link used to disagree about a page in a folder: the link went to `/account/security`,
 * a flow's `navigate` to `/security`, and to the home page for a folder's index — whose own slug is empty.
 */
const navigationTarget = (pages: Record<string, Element>, pageFolders: PageFolder[], target: string): string => {
  // A section of a page — `home#plans` — goes to that page, and the fragment comes along for the router to scroll to.
  const fragmentAt = target.indexOf('#');
  if (fragmentAt > 0) {
    return `${navigationTarget(pages, pageFolders, target.slice(0, fragmentAt))}${target.slice(fragmentAt)}`;
  }

  const page = pages[target] as Element | undefined;
  if (!page) {
    return target;
  }

  const { slug, default: isHome } = page.attributes as { slug?: unknown; default?: boolean };
  if (typeof slug === 'string') {
    return getPageFullPath(pages, pageFolders, target, true);
  }

  return isHome ? '/' : `/${target}`;
};

const isPageAuthored = (accessLevel?: NavigationAccessLevel, authenticated?: boolean, previewMode: boolean = true) => {
  if (!accessLevel || !previewMode || typeof authenticated === 'undefined') {
    return true;
  }

  if (authenticated && accessLevel === 'authenticated') {
    return true;
  }

  if (!authenticated && accessLevel === 'public') {
    return true;
  }

  if (authenticated && accessLevel === 'public') {
    return false;
  }

  return !accessLevel;
};

const getPaths = (
  pages: Record<string, Element> = {},
  pageFolders: PageFolder[] = [],
  authenticated?: boolean,
  basePath: string = '',
  previewMode: boolean = true
) => {
  const paths = Object.keys(pages)
    .reduce<Path[]>((acum, pageId) => {
      const {
        attributes: { accessLevel, enabled = true, unauthorizedBehaviour }
      } = pages[pageId];
      // Typed here rather than asserted at every use: an element's attributes are an open bag, and this one is
      // either a page id or a URL — a string in both cases.
      let unauthorizedPageRedirect = pages[pageId].attributes.unauthorizedPageRedirect as string | undefined;

      if (!enabled && previewMode) {
        return acum;
      }

      /**
       * A page id, resolved to its path — unless it points off-site, which is left exactly as written.
       *
       * A space does not have to keep its sign-in inside itself. Pointing this at another origin is how a space
       * says "whoever is not signed in belongs over there", which is what one shared sign-in screen for a whole
       * platform requires — and, later, what an identity provider requires. Run through `getPageFullPath`, such a
       * URL comes back as `/https:/auth.example.com`, a path inside this space that does not exist.
       */
      if (unauthorizedPageRedirect) {
        unauthorizedPageRedirect = isOffSite(unauthorizedPageRedirect)
          ? unauthorizedPageRedirect
          : getPageFullPath(pages, pageFolders, unauthorizedPageRedirect, true);
      }

      const subPaths = getPageFullPath(pages, pageFolders, pageId);
      const notFound = pages[pageId].attributes.slug === NOT_FOUND_SLUG;
      const subPathsParsed = Object.keys(subPaths).map(subPath => {
        return {
          pageId,
          path: `${basePath}${subPath}`.replaceAll('//', '/'),
          accessLevel,
          enabled,
          isRaw: `/${pageId}` === subPath,
          unauthorizedBehaviour,
          unauthorizedPageRedirect,
          hasAccess: isPageAuthored(accessLevel as NavigationAccessLevel, authenticated, previewMode),
          ...(notFound ? { notFound: true } : {})
        } as Path;
      });

      return [...acum, ...subPathsParsed] as Path[];
    }, [])
    .sort((pathA: Path, pathB: Path) => {
      // A "not found" page answers only what nothing else does: after every other page — `/*` matches `/` too — and,
      // by the order below (`*` sorts under any slug), the deepest folder's before the space's.
      if (Boolean(pathA.notFound) !== Boolean(pathB.notFound)) {
        return pathA.notFound ? 1 : -1;
      }

      if (pathA.path === pathB.path) {
        return pathA.accessLevel === 'authenticated' ? -1 : 1;
      }

      return pathA.path > pathB.path ? -1 : 1;
    });

  return paths;
};

const matchRoutePath = (
  paths: Path[],
  pathName: string,
  authenticated: boolean
): {
  action: { type: 'authenticated' | 'accessDenied' | 'redirect' | 'notFound' | 'normal'; path?: string };
  pathMatch?: PathMatch;
  pageId?: string;
} => {
  if (!pathName) {
    return { action: { type: 'accessDenied', path: undefined }, pathMatch: undefined };
  }

  const candidates: { matchResult: PathMatch; path: Path; pageId: string }[] = [];

  // Filter all possible Matches
  paths.forEach(path => {
    const result = matchPath({ path: path.path, end: path.path !== '*' }, pathName);

    if (result) {
      candidates.push({ matchResult: result, path, pageId: path.pageId });
    }
  });

  // The best match among some candidates: one this visitor may see, else one they may not — a possible redirect.
  const best = (among: typeof candidates) =>
    among.find(
      ({ path: { accessLevel } }) =>
        (accessLevel === 'authenticated' && authenticated) ||
        (accessLevel === 'public' && !authenticated) ||
        !accessLevel
    ) ??
    among.find(
      ({ path: { accessLevel } }) =>
        (accessLevel === 'authenticated' && !authenticated) || (accessLevel === 'public' && authenticated)
    );

  // A "not found" page only where no page answers at all: a page this visitor may not see still sends them on.
  const possibleCandidate =
    best(candidates.filter(({ path }) => !path.notFound)) ?? best(candidates.filter(({ path }) => path.notFound));

  if (!possibleCandidate) {
    return { action: { type: 'notFound', path: undefined }, pathMatch: undefined };
  }

  const {
    pageId,
    matchResult,
    path: { hasAccess, unauthorizedBehaviour, unauthorizedPageRedirect, notFound }
  } = possibleCandidate;
  if (!hasAccess && unauthorizedBehaviour === 'redirect' && unauthorizedPageRedirect) {
    return { action: { type: 'redirect', path: unauthorizedPageRedirect }, pathMatch: undefined };
  }

  // The space's "not found" page answers with its status, whichever of its addresses was asked for.
  if (hasAccess) {
    return { action: { type: notFound ? 'notFound' : 'normal', path: undefined }, pathMatch: matchResult, pageId };
  }

  return { action: { type: 'accessDenied', path: undefined }, pathMatch: undefined };
};

/** The space's "not found" page for an address — its deepest folder's, or the space's — when it declares one. */
const notFoundPageFor = (paths: Path[], pathName: string): string | undefined =>
  paths.find(path => path.hasAccess && path.notFound && matchPath({ path: path.path, end: true }, pathName))?.pageId;

const getRouteParams = (path: string) => {
  if (!path || typeof path !== 'string') {
    return [];
  }

  const params = path.match(/:[a-zA-Z0-9-_:*]+/gim) || [];

  return params.map(param => param.replace(':', ''));
};

/** The params a page's slug declares, in either spelling a slug accepts: `post/{{slug}}` and `:spaceId/update`. */
const getSlugParams = (slug: string): string[] => getRouteParams(parsePath(slug));

export {
  getPageFullPath,
  getPaths,
  matchRoutePath,
  notFoundPageFor,
  isPageAuthored,
  getRouteParams,
  getSlugParams,
  navigationTarget
};
