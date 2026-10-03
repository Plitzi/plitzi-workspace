const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * Whether a link's path is the page being shown, given the page's whole address (`navigation.href`). Paths alone: the
 * query and the section (`#plans`) are the same page. Undefined while no address is known — nothing is current then.
 */
export const isCurrentPage = (path: string, location: string | undefined): boolean => {
  if (!location || !path.startsWith('/')) {
    return false;
  }

  try {
    const shown = new URL(location).pathname;
    const linked = new URL(path, location).pathname;

    return withoutTrailingSlash(decodeURI(shown)) === withoutTrailingSlash(decodeURI(linked));
  } catch {
    return false;
  }
};
