// Packages
import { matchPath } from 'react-router-dom';
import get from 'lodash/get.js';

export const ACCESS_LEVEL_PUBLIC = 'public';
export const ACCESS_LEVEL_AUTHENTICATED = 'authenticated';

export const ACTION_TYPE_ACCESS_DENIED = 'accessDenied';
export const ACTION_TYPE_NORMAL = 'normal';
export const ACTION_TYPE_REDIRECT = 'redirect';
export const ACTION_TYPE_NOT_FOUND = 'notFound';

const parsePath = path => path.replace(/{{([a-zA-Z0-9-_:*/]+)}}/i, ':$1').replaceAll(/[/]+/gim, '/');

const recursiveFolderSlug = (pageFolders, pageFolderId) => {
  if (!Array.isArray(pageFolders) || !pageFolderId || !pageFolders[pageFolderId]) {
    return '';
  }

  const pageFolder = pageFolders[pageFolderId];
  const { slug, parentId } = pageFolder;
  if (!parentId) {
    return slug;
  }

  return `${recursiveFolderSlug(pageFolders, parentId)}/${slug}`;
};

const getPageFullPath = (flat, pageFolders, pageId, asString = false) => {
  const {
    slug: pageSlug = '',
    folder: folderId,
    default: defaultPage
  } = get(flat, `${pageId}.attributes`, { slug: pageId, folder: '' });
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

  const pageFolder = pageFolders.find(pageFolder => pageFolder.id === folderId);
  if (!pageFolder && !asString) {
    return { [parsePath(`/${pageSlug}`)]: pageId, [`/${pageId}`]: pageId };
  }

  if (!pageFolder && asString) {
    return `/${pageSlug}`;
  }

  const path = [recursiveFolderSlug(pageFolders, folderId), pageFolder.slug, pageSlug].filter(Boolean).join('/');
  if (asString) {
    return `/${path}`;
  }

  return { [`/${path}`]: pageId, [`/${pageId}`]: pageId };
};

const isPageAuthored = (accessLevel, authenticated, previewMode = true) => {
  if (!accessLevel || !previewMode) {
    return true;
  }

  if (authenticated && accessLevel === ACCESS_LEVEL_AUTHENTICATED) {
    return true;
  }

  if (!authenticated && accessLevel === ACCESS_LEVEL_PUBLIC) {
    return true;
  }

  if (authenticated && accessLevel === ACCESS_LEVEL_PUBLIC) {
    return false;
  }

  return !accessLevel;
};

const getPaths = (pages, flat, pageFolders, authenticated, basePath = '', previewMode = true, strictMode = true) => {
  const paths = pages
    .reduce((acum, pageId) => {
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
        unauthorizedPageRedirect = getPageFullPath(flat, pageFolders, unauthorizedPageRedirect.replace('/', ''), true);
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
          hasAccess: isPageAuthored(accessLevel, authenticated, previewMode)
        };
      });
      return [...acum, ...subPathsParsed];
    }, [])
    .filter(path => path.path !== '*' || path.hasAccess)
    .sort((pathA, pathB) => {
      if (pathA.path === pathB.path) {
        return pathA.accessLevel === ACCESS_LEVEL_AUTHENTICATED ? -1 : 1;
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

const matchRoutePath = (paths, pathName, authenticated, filter = '') => {
  if (!pathName) {
    return { action: { type: ACTION_TYPE_ACCESS_DENIED, path: undefined }, pathMatch: undefined };
  }

  const candidates = [];
  if (filter) {
    return paths.find(path => path.path === filter && path.hasAccess);
  }

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
      (accessLevel === ACCESS_LEVEL_AUTHENTICATED && authenticated) ||
      (accessLevel === ACCESS_LEVEL_PUBLIC && !authenticated) ||
      !accessLevel
  );

  if (!possibleCandidate) {
    // Match without permission, possible redirect
    possibleCandidate = candidates.find(
      ({ path: { accessLevel } }) =>
        (accessLevel === ACCESS_LEVEL_AUTHENTICATED && !authenticated) ||
        (accessLevel === ACCESS_LEVEL_PUBLIC && authenticated)
    );
  }

  if (!possibleCandidate) {
    // @todo: implement a better way to handle this, because if is not found we should render the 404 page
    // Last opportunity going to root level
    possibleCandidate = paths.find(candidate => candidate.path === '/' && candidate.hasAccess);

    if (possibleCandidate) {
      return { action: { type: ACTION_TYPE_REDIRECT, path: '/' }, pathMatch: undefined };
    }
  }

  if (!possibleCandidate) {
    return { action: { type: ACTION_TYPE_NOT_FOUND, path: undefined }, pathMatch: undefined };
  }

  const {
    pageId,
    matchResult,
    path: { hasAccess, unauthorizedBehaviour, unauthorizedPageRedirect }
  } = possibleCandidate;
  if (!hasAccess && unauthorizedBehaviour === 'redirect' && unauthorizedPageRedirect) {
    return { action: { type: ACTION_TYPE_REDIRECT, path: unauthorizedPageRedirect }, pathMatch: undefined };
  }

  if (hasAccess) {
    return { action: { type: ACTION_TYPE_NORMAL, path: undefined }, pathMatch: matchResult, pageId };
  }

  return { action: { type: ACTION_TYPE_ACCESS_DENIED, path: undefined }, pathMatch: undefined };
};

const getRouteParams = path => {
  if (!path || typeof path !== 'string') {
    return [];
  }

  const params = path.match(/:[a-zA-Z0-9-_:*]+/gim) || [];

  return params.map(param => param.replace(':', ''));
};

export { getPageFullPath, getPaths, matchRoutePath, isPageAuthored, getRouteParams };
