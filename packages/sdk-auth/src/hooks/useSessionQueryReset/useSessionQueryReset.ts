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
    // Asked again for whoever is looking now, unless that is nobody: a sign-out has no session to ask with, and
    // every provider still on screen would answer 401.
    void queryCache.reset({ refetch: identity !== '' });
  }, [identity]);
};

export default useSessionQueryReset;
