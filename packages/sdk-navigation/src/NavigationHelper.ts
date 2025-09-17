import get from 'lodash/get.js';
import { matchPath } from 'react-router-dom';

import type { Schema, PageFolder } from '@plitzi/sdk-shared';
import type { PathMatch } from 'react-router-dom';

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

function getPageFullPath(flat: Schema['flat'], pageFolders: PageFolder[], pageId: string, asString: true): string;
function getPageFullPath(
  flat: Schema['flat'],
  pageFolders: PageFolder[],
  pageId: string,
  asString?: false
): Record<string, string>;
function getPageFullPath(
  flat: Schema['flat'],
  pageFolders: PageFolder[],
  pageId: string,
  asString: boolean = false
): string | Record<string, string> {
  const {
    slug: pageSlug = '',
    folder: folderId,
    default: defaultPage
  } = get(flat, `${pageId}.attributes`, { slug: pageId, folder: '', default: false }) as {
    slug?: string;
    folder: string;
    default: boolean;
  };
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
  const path = [recursiveFolderSlug(pageFoldersObj, folderId), pageSlug].filter(Boolean).join('/');
  if (asString) {
    return `/${path}`;
  }

  return { [`/${path}`]: pageId, [`/${pageId}`]: pageId };
}

const isPageAuthored = (accessLevel?: NavigationAccessLevel, authenticated?: boolean, previewMode: boolean = true) => {
  if (!accessLevel || !previewMode) {
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
  pages: string[],
  flat: Schema['flat'],
  pageFolders: PageFolder[],
  authenticated: boolean,
  basePath: string = '',
  previewMode: boolean = true,
  strictMode: boolean = true
) => {
  const paths = pages
    .reduce<Path[]>((acum, pageId) => {
      const {
        attributes: { accessLevel, enabled, unauthorizedBehaviour }
      } = flat[pageId];
      let {
        attributes: { unauthorizedPageRedirect }
      } = flat[pageId];

      if (typeof enabled === 'boolean' && !enabled && previewMode) {
        return acum;
      }

      if (unauthorizedPageRedirect) {
        unauthorizedPageRedirect = getPageFullPath(
          flat,
          pageFolders,
          (unauthorizedPageRedirect as string).replace('/', ''),
          true
        );
      }

      const subPaths = getPageFullPath(flat, pageFolders, pageId);
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
