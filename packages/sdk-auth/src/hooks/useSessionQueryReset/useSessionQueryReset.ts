import { useEffect, useRef } from 'react';

import { queryCache } from '@plitzi/sdk-shared/queries';

/**
 * Forgets every cached browser request when the person the page is for changes — a sign-in, a sign-out, another
 * account.
 *
 * A request's cache key carries the token it was sent with, but a request authenticated by cookie carries nothing
 * that tells two visitors apart, and its answer would otherwise be served to whoever signs in next. A token renewal
 * is the same person, so `identity` is who they are, never the credential.
 */
const useSessionQueryReset = (identity: string): void => {
  const previous = useRef(identity);

  useEffect(() => {
    if (previous.current === identity) {
      return;
    }

    previous.current = identity;
    void queryCache.reset();
  }, [identity]);
};

export default useSessionQueryReset;
