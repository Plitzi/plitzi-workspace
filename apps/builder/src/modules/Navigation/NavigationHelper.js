// Packages
import { matchPath } from 'react-router-dom';
import get from 'lodash/get';

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
    return { '/': pageId, [`/${pageId}`]: pageId, '*': pageId };
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

  const { slug: folderSlug } = pageFolder;

  if (asString) {
    return `${recursiveFolderSlug(pageFolders, folderId)}/${folderSlug}/${pageSlug}`;
  }

  return {
    [parsePath(`${recursiveFolderSlug(pageFolders, folderId)}/${folderSlug}/${pageSlug}`)]: pageId,
    [`/${pageId}`]: pageId
  };
};

const isPageAuthored = (accessLevel, authenticated, previewMode = true) => {
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

const getPaths = (pages, flat, pageFolders, authenticated, previewMode = true) => {
  const paths = pages
    .filter(pageId => {
      const {
        attributes: { accessLevel, enabled }
      } = flat[pageId];

      if (typeof enabled === 'boolean' && !enabled && previewMode) {
        return false;
      }

      return isPageAuthored(accessLevel, authenticated, previewMode);
    })
    .reduce((acum, pageId) => ({ ...acum, ...getPageFullPath(flat, pageFolders, pageId) }), {});

  if (!paths['*'] && paths['/']) {
    paths['*'] = paths['/'];
  } else if (!paths['*'] && Object.keys(paths).length > 0) {
    [paths['*']] = Object.keys(paths).sort((pathA, pathB) => (pathA > pathB ? 1 : -1));
  } else {
    paths['*'] = null;
  }

  return paths;
};

const matchRoutePath = (paths, pathName) => {
  let result;
  Object.keys(paths)
    .sort((pathA, pathB) => (pathA > pathB ? -1 : 1))
    .forEach(path => {
      if (!result) {
        result = matchPath({ path, end: path !== '*' }, pathName);
      }
    });

  return result;
};

export { getPageFullPath, getPaths, matchRoutePath };
