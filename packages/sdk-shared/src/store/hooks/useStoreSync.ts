import { use, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi, SyncMode } from '../../types/StoreTypes';

export type UseStoreSyncReturn<TState extends object, P extends PathOf<TState>> = [
  PathValue<TState, P>,
  (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
];

function useStoreSync<TState extends object, P extends PathOf<TState>>(
  path: P,
  value: PathValue<TState, P>,
  mode: SyncMode = 'sync',
  equalityFn: (a: PathValue<TState, P>, b: PathValue<TState, P>) => boolean = Object.is
): UseStoreSyncReturn<TState, P> {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStoreSync must be used inside a StoreProvider');
  }

  // ── Sync write ────────────────────────────────────────────────────────────

  const lastSyncedRef = useRef<PathValue<TState, P> | undefined>(undefined);
  const mountedRef = useRef(false);

  const shouldSync =
    !mountedRef.current || (mode === 'sync' && !equalityFn(lastSyncedRef.current as PathValue<TState, P>, value));

  if (shouldSync) {
    lastSyncedRef.current = value;
    store.setState(path, value);
  }

  mountedRef.current = true;

  // ── Read side (fully typed) ───────────────────────────────────────────────

  const getSnapshot = useMemo(() => (): PathValue<TState, P> => getByPath(store.getState(), path), [store, path]);

  const subscribe = useMemo(() => (cb: () => void) => store.subscribePath(path, cb), [store, path]);

  const lastSelectedRef = useRef<PathValue<TState, P>>(getSnapshot());

  const selected = useSyncExternalStore(subscribe, () => {
    const next = getSnapshot();
    if (equalityFn(lastSelectedRef.current, next)) {
      return lastSelectedRef.current;
    }

    lastSelectedRef.current = next;

    return next;
  });

  // ── Setter ────────────────────────────────────────────────────────────────

  const setState = useCallback(
    (v: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => {
      store.setState(path, v);
    },
    [store, path]
  );

  return [selected, setState];
}

export default useStoreSync;
