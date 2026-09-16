import { useEffect } from 'react';

import { registerDevStore } from '@plitzi/nexus';
import { queryCache } from '@plitzi/sdk-shared/queries';

/**
 * Puts the page's cached browser requests in the dev store registry, as "Queries".
 *
 * The cache is a store of its own, created by no provider, so nexus never registers it. It is tagged with the
 * instance showing the panel: the panel reads an untagged store as the app root and opens it by default. One page
 * has one cache, so only the selected instance registers it — a second registration of the same store would drop
 * both when either unmounts.
 */
const useRegisterQueriesStore = (enabled: boolean, instanceId: string): void => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return registerDevStore(queryCache.store, instanceId, 'Queries');
  }, [enabled, instanceId]);
};

export default useRegisterQueriesStore;
