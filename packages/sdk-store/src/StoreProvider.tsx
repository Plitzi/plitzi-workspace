/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useEffect, useMemo, useRef } from 'react';

import createStore from './createStore';
import useStoreSync from './hooks/useStoreSync';
import { StoreContext } from './StoreContext';

import type { StoreApi, StoreLogger } from './types';
import type { ReactNode } from 'react';

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  path?: string;
  value?: Partial<TState> | ((state: TState) => TState);
  /**
   * How this scope derives from the parent store:
   * - `'snapshot'`: copy parent keys once at init; isolated thereafter (writes stay local, parent updates do
   *   not propagate). Use for draft/diverge editors.
   * - `'live'`: live scope chain — reads fall through to the parent, own keys shadow inherited ones, and writes
   *   delegate to the owning scope. Parent updates propagate.
   * - `undefined` (default): no inheritance.
   */
  inherit?: 'snapshot' | 'live';
  autoSync?: boolean;
  logger?: StoreLogger<TState>;
  children?: ReactNode;
};

const StoreProvider = <TState extends object = any>({
  store,
  path,
  value,
  inherit,
  autoSync = true,
  logger,
  children
}: StoreProviderProps<TState>) => {
  const parentStore = use<StoreApi<TState> | undefined>(StoreContext);
  const storeRef = useRef<StoreApi<TState>>(undefined);
  const liveChain = inherit === 'live';
  const storeState = useMemo(() => {
    const parentState = inherit === 'snapshot' && parentStore ? parentStore.getState() : ({} as TState);

    return typeof value === 'function' ? value(parentState) : { ...parentState, ...value };
  }, [inherit, parentStore, value]);

  if (!storeRef.current) {
    if (store) {
      storeRef.current = store;
    } else {
      storeRef.current = createStore<TState>(() => storeState, {
        logger,
        parent: liveChain ? parentStore : undefined
      });
    }
  }

  useEffect(
    () => () => {
      if (liveChain && !store) {
        storeRef.current?.destroy?.();
      }
    },
    [liveChain, store]
  );

  const syncEnabled = !!value && autoSync;

  useStoreSync(path as any, (path ? value : storeState) as any, {
    enabled: syncEnabled && !!path,
    store: storeRef.current
  });
  useStoreSync<TState>(undefined, storeState as Partial<TState>, {
    enabled: syncEnabled && !path,
    store: storeRef.current
  });

  return <StoreContext value={storeRef.current}>{children}</StoreContext>;
};

export { StoreContext };

export default StoreProvider;
