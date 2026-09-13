import { useContext, useEffect } from 'react';

import { registerDevStore } from '@plitzi/nexus';
import { isDev } from '@plitzi/nexus/env';
import { StoreContext } from '@plitzi/nexus/react';

/**
 * Puts the store this container sits in — the app's root store — in the dev store registry.
 *
 * Nexus registers every provider itself in a dev build, but in a production build only the ones beneath a
 * `DevStoreScopeContext`, and the container provides that context for what it wraps, never for the store above it.
 * So a panel switched on in production listed every row and provider on the page and not the root, which is the store
 * worth opening first. Registered untagged, so the panel labels it `root` and selects it by default. Nothing in dev:
 * nexus already has it there, and a second registration of the same store would unregister both on unmount.
 */
const useRegisterRootStore = (enabled: boolean): void => {
  const rootStore = useContext(StoreContext);

  useEffect(() => {
    if (!enabled || isDev || !rootStore) {
      return;
    }

    return registerDevStore(rootStore);
  }, [enabled, rootStore]);
};

export default useRegisterRootStore;
