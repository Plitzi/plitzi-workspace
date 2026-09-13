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

/**
 * Is this a destination outside this space — either already absolute, or a token that will resolve to one?
 *
 * The token half matters because the address of an off-site sign-in differs per environment, so a space writes it
 * as `{{authUrl}}/` and not as a host. Page ATTRIBUTES are never interpolated (only a step's params are), so the
 * token is still there when the route table is built — and running it through the page resolver turned
 * `{{authUrl}}/` into `/{{authUrl}}`, a path inside this space, before anything had a chance to resolve it.
 */
const isOffSite = (url: string): boolean => isAbsoluteUrl(url) || url.includes('{{');

const parsePath = (path: string) => path.replace(/{{([a-zA-Z0-9-_:*/]+)}}/i, ':$1').replaceAll(/[/]+/gim, '/');

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
  const {
    slug: pageSlug = '',
    folder: folderId,
    default: defaultPage
  } = ((pages[pageId] as Element | undefined)?.attributes ?? {
    slug: pageId,
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
    return { [parsePath(`/${pageSlug}`)]: pageId, [`/${pageId}`]: pageId };
  }

  if (!folderId && asString) {
    return `/${pageSlug}`;
  }

  const pageFolder = pageFolders.find((pageFolder: PageFolder) => pageFolder.id === folderId);
  if (!pageFolder) {
    return asString ? `/${pageSlug}` : { [parsePath(`/${pageSlug}`)]: pageId, [`/${pageId}`]: pageId };
  }

  const pageFoldersObj = pageFolders.reduce((acum, pageFolder) => ({ ...acum, [pageFolder.id]: pageFolder }), {});
  const path = [recursiveFolderSlug(pageFoldersObj, folderId), pageSlug ? pageSlug : pageId].filter(Boolean).join('/');
  if (asString) {
    return `/${path}`;
  }

  return { [`/${path}`]: pageId, [`/${pageId}`]: pageId };
}

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
  previewMode: boolean = true,
  strictMode: boolean = true
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
          : getPageFullPath(pages, pageFolders, unauthorizedPageRedirect.replace('/', ''), true);
      }

      const subPaths = getPageFullPath(pages, pageFolders, pageId);
      const subPathsParsed = Object.keys(subPaths).map(subPath => {
        return {
          pageId,
          path: `${basePath}${subPath}`.replaceAll('//', '/'),
          accessLevel,
          enabled,
          isRaw: `/${pageId}` === subPath,
          unauthorizedBehaviour,
          unauthorizedPageRedirect,
          hasAccess: isPageAuthored(accessLevel as NavigationAccessLevel, authenticated, previewMode)
        } as Path;
      });

      return [...acum, ...subPathsParsed] as Path[];
    }, [])
    .filter((path: Path) => path.path !== '*' || path.hasAccess)
    .sort((pathA: Path, pathB: Path) => {
      if (pathA.path === pathB.path) {
        return pathA.accessLevel === 'authenticated' ? -1 : 1;
      }

      return pathA.path > pathB.path ? -1 : 1;
    });

  if (!paths.find(path => path.path === '*') && !strictMode) {
    const defaultPath = paths.find(path => path.path === '/' && path.hasAccess);
    if (defaultPath && defaultPath.unauthorizedBehaviour === 'redirect' && defaultPath.unauthorizedPageRedirect) {
      paths.push({
        ...defaultPath,
        path: '*',
        hasAccess: false,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/'
      });
    }
  }

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

  // Find the best match
  let possibleCandidate = candidates.find(
    ({ path: { accessLevel } }) =>
      (accessLevel === 'authenticated' && authenticated) || (accessLevel === 'public' && !authenticated) || !accessLevel
  );

  if (!possibleCandidate) {
    // Match without permission, possible redirect
    possibleCandidate = candidates.find(
      ({ path: { accessLevel } }) =>
        (accessLevel === 'authenticated' && !authenticated) || (accessLevel === 'public' && authenticated)
    );
  }

  if (!possibleCandidate) {
    // @todo: implement a better way to handle this, because if is not found we should render the 404 page
    // Last opportunity going to root level
    const possibleCandidatePath = paths.find(candidate => candidate.path === '/' && candidate.hasAccess);

    if (possibleCandidatePath) {
      return { action: { type: 'redirect', path: '/' }, pathMatch: undefined };
    }
  }

  if (!possibleCandidate) {
    return { action: { type: 'notFound', path: undefined }, pathMatch: undefined };
  }

  const {
    pageId,
    matchResult,
    path: { hasAccess, unauthorizedBehaviour, unauthorizedPageRedirect }
  } = possibleCandidate;
  if (!hasAccess && unauthorizedBehaviour === 'redirect' && unauthorizedPageRedirect) {
    return { action: { type: 'redirect', path: unauthorizedPageRedirect }, pathMatch: undefined };
  }

  if (hasAccess) {
    return { action: { type: 'normal', path: undefined }, pathMatch: matchResult, pageId };
  }

  return { action: { type: 'accessDenied', path: undefined }, pathMatch: undefined };
};

const getRouteParams = (path: string) => {
  if (!path || typeof path !== 'string') {
    return [];
  }

  const params = path.match(/:[a-zA-Z0-9-_:*]+/gim) || [];

  return params.map(param => param.replace(':', ''));
};

export { getPageFullPath, getPaths, matchRoutePath, isPageAuthored, getRouteParams };
