import { useEffect, useRef } from 'react';

import { registerServerQuery } from './serverQueries';

export type UseServerQueryOptions = {
  id: string;
  /** The URL the server reads for a provider that has nothing but a `query`. */
  url?: string;
  /** Whether the provider has a live answer to refresh at all — never in the builder, which has no page server. */
  enabled: boolean;
  /** Whether it is on screen: an invalidation of a hidden one waits until it is shown, as a cached query does. */
  active: boolean;
  refresh: () => Promise<void>;
};

/**
 * Keeps a server-driven provider reachable by the invalidations — `invalidateQueries`, and the refresh a write step
 * asks for — for as long as it is mounted and `enabled`.
 *
 * The same saving the cache makes for a hidden query: a provider in a tab nobody is looking at is only marked, and
 * asks when it is shown, so a write does not turn into a request for every section the visitor cannot see.
 */
const useServerQuery = ({ id, url, enabled, active, refresh }: UseServerQueryOptions): void => {
  const missed = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (active && missed.current) {
      missed.current = false;
      void refresh();
    }

    return registerServerQuery({
      id,
      url,
      refresh: () => {
        if (!active) {
          missed.current = true;

          return Promise.resolve();
        }

        return refresh();
      }
    });
  }, [enabled, active, id, url, refresh]);
};

export default useServerQuery;
