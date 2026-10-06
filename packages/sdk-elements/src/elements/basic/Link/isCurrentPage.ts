const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * Whether a link leads to the page being shown, given the page's whole address (`navigation.href`). The section
 * (`#plans`) is the same page, and so is any query the link does not name. A query it does name must be the one shown:
 * `/?window=6h` and `/?window=24h` are one path, and with the path alone every window's link was the current one.
 * Undefined while no address is known — nothing is current then.
 */
export const isCurrentPage = (path: string, location: string | undefined): boolean => {
  if (!location || !path.startsWith('/')) {
    return false;
  }

  try {
    const shown = new URL(location);
    const linked = new URL(path, location);
    if (withoutTrailingSlash(decodeURI(shown.pathname)) !== withoutTrailingSlash(decodeURI(linked.pathname))) {
      return false;
    }

    return [...linked.searchParams].every(([name, value]) => shown.searchParams.getAll(name).includes(value));
  } catch {
    return false;
  }
};
