import { useRef } from 'react';

import useIsomorphicLayoutEffect from '@plitzi/sdk-shared/hooks/useIsomorphicLayoutEffect';
import { queryCache } from '@plitzi/sdk-shared/queries';

/**
 * Forgets every cached browser request when the person the page is for changes — a sign-in, a sign-out, another
 * account.
 *
 * A request's cache key carries the token it was sent with, but a request authenticated by cookie carries nothing
 * that tells two visitors apart, and its answer would otherwise be served to whoever signs in next. A token renewal
 * is the same person, so `identity` is who they are, never the credential.
 *
 * In the LAYOUT phase, which is the whole of why it lands before anything below asks. A sign-in mounts the account
 * area in the same commit that changes who is looking, and a provider asks from an ordinary effect — every one of
 * those runs after every layout effect of the commit. From a passive effect here the account area had already sent
 * its requests, so forgetting and asking again duplicated all of them and cancelled the two still in flight.
 */
const useSessionQueryReset = (identity: string): void => {
  const previous = useRef(identity);

  useIsomorphicLayoutEffect(() => {
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
