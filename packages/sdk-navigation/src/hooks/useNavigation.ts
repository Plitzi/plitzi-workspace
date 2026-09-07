import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import { ParamsFromURL } from '@plitzi/sdk-shared/helpers/utils';

import type { QueryParams, Server } from '@plitzi/sdk-shared';

export type UseNavigationProps = {
  server: Server;
  /**
   * Where the ROUTER thinks it is, when there is one.
   *
   * `window.location` is not the answer, and was: a space embedded in an application that has a router of its own
   * routes in memory, so the window's address never changes and every internal link looked like it did nothing.
   * The window is still where the HOSTNAME comes from — a router has no idea what host it is on, and a space's
   * per-environment variables are keyed on exactly that.
   */
  routerLocation?: { pathname: string; search: string };
};

const useNavigation = ({ server, routerLocation }: UseNavigationProps) => {
  const windowLocation = useMemo<Location>(
    () => (typeof window !== 'undefined' ? window.location : get(server, 'location', { pathname: '/' } as Location)),
    [server]
  );

  /**
   * The router's path and query, over the window's own idea of WHERE it is.
   *
   * Field by field rather than by spreading `window.location`: that is a class instance, and spreading one keeps
   * only its own properties — everything it answers through its prototype is lost, `href` among them, which is what
   * an off-origin sign-in sends somebody back to.
   */
  const location = useMemo<Location>(() => {
    if (!routerLocation) {
      return windowLocation;
    }

    const { origin, host, hostname, protocol, href } = windowLocation;
    const { pathname, search } = routerLocation;

    return {
      origin,
      host,
      hostname,
      protocol,
      pathname,
      search,
      hash: '',
      /**
       * Composed only when there IS an origin to compose from.
       *
       * A server render has no window: its location is whatever the request carried, and that object may have an
       * `href` and nothing else. Building one from an absent origin produced `undefined/analytics`, which is what
       * an off-origin sign-in then handed over as the page to come back to.
       */
      href: origin ? `${origin}${pathname}${search}` : href
    } as Location;
  }, [windowLocation, routerLocation]);

  const queryParams = useMemo<QueryParams>(() => ParamsFromURL(location.search), [location.search]);
  const hostname = useMemo(() => (location.hostname ? location.hostname : 'localhost'), [location.hostname]);
  const navigationData = useMemo(() => ({ queryParams, hostname, location }), [queryParams, hostname, location]);

  return navigationData;
};

export default useNavigation;
