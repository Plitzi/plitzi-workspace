import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { PathOf, PathValue, StoreApi } from '@plitzi/nexus';
import type { CommonState } from '@plitzi/sdk-shared';

/**
 * The values an element reads of the store, followed in the browser — the same list while they are the same, a new one
 * when any of them changes. In the browser the store's hook does it; on the server, which draws a page once and follows
 * nothing, they are read once. The hook was a subscription's worth of state and closures, set up on every element of a
 * page to read each value once: what `useSyncExternalStore` asks of it on the server is exactly this read.
 */
type StoreValues = (store: StoreApi<CommonState>, paths: readonly PathOf<CommonState>[]) => readonly unknown[];

const useStoreValuesInBrowser: StoreValues = (store, paths) => {
  const [values] = useCommonStore(paths, { store });

  return values;
};

const readStoreValues: StoreValues = (store, paths) => paths.map(path => store.getPath(path));

const isServer = typeof window === 'undefined';

// Chosen once, as the module loads: a page is drawn on the server or in a browser for the whole life of the process.
export const useStoreValues: StoreValues = isServer ? readStoreValues : useStoreValuesInBrowser;

/** One value, the same way: followed in the browser, read once on the server. */
const useStoreValueInBrowser = <P extends PathOf<CommonState>>(
  store: StoreApi<CommonState>,
  path: P
): PathValue<CommonState, P> | undefined => {
  const [value] = useCommonStore(path, { store });

  return value;
};

const readStoreValue = <P extends PathOf<CommonState>>(
  store: StoreApi<CommonState>,
  path: P
): PathValue<CommonState, P> | undefined => store.getPath(path);

export const useStoreValue = isServer ? readStoreValue : useStoreValueInBrowser;
