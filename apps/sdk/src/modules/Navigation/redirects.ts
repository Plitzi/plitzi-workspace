/**
 * The page somebody actually asked for, absolute, so an off-origin sign-in can send them back to it.
 *
 * `href` is there in a browser and usually on the server's own location object too; the pieces are composed only
 * when it is not, because a redirect back to a URL missing its query string loses whatever the deep link carried.
 */
export const currentUrl = (location: Location): string => {
  if (location.href) {
    return location.href;
  }

  const protocol = location.protocol || 'https:';

  return `${protocol}//${location.host || location.hostname}${location.pathname}${location.search}`;
};

/** `path` with where the visitor was going as its `redirect`, unless the space already wrote one there. */
export const withRedirect = (path: string, from: string): string => {
  const [pathname, query = ''] = path.split('?', 2);
  const params = new URLSearchParams(query);
  if (!params.has('redirect')) {
    params.set('redirect', from);
  }

  return `${pathname}?${params.toString()}`;
};

/**
 * Where a visitor who signed in on a page for signed-out visitors goes: back to the `redirect` the address carries —
 * the one `withRedirect` gave them on the way to the sign-in — when it is on this site; anything else is no answer.
 *
 * A run's sign-in sent everybody home: the page's rule fired the moment the flow's login succeeded, before the flow's
 * own step could read where to go, and the address it would have read was already the home page's.
 */
export const returnTo = (location: Location): string | undefined => {
  const asked = new URLSearchParams(location.search).get('redirect');
  if (!asked) {
    return undefined;
  }

  try {
    const here = new URL(currentUrl(location));
    const there = new URL(asked, here);

    return there.origin === here.origin ? `${there.pathname}${there.search}${there.hash}` : undefined;
  } catch {
    return undefined;
  }
};
