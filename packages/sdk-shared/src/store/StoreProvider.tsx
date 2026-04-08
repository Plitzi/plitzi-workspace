/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, use, useMemo, useRef } from 'react';

import createStore from './createStore';
import useStoreSync from './hooks/useStoreSync';

import type { StoreApi, StoreLogger } from '../types';
import type { ReactNode } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreApi<any> | undefined>(undefined);

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  path?: string;
  value?: Partial<TState> | ((state: TState) => TState);
  inherit?: boolean;
  autoSync?: boolean;
  logger?: StoreLogger<TState>;
  children?: ReactNode;
};

const StoreProvider = <TState extends object = any>({
  store,
  path,
  value,
  inherit = false,
  autoSync = true,
  logger,
  children
}: StoreProviderProps<TState>) => {
  const parentStore = use(StoreContext) as StoreApi<TState> | undefined;
  const storeRef = useRef<StoreApi<TState>>(undefined);
  const storeState = useMemo(() => {
    const parentState = inherit && parentStore ? parentStore.getState() : ({} as TState);

    return typeof value === 'function' ? value(parentState) : { ...parentState, ...(value ?? {}) };
  }, [inherit, parentStore, value]);

  if (!storeRef.current) {
    if (store) {
      storeRef.current = store;
    } else {
      storeRef.current = createStore<TState>(() => storeState, { logger });
    }
  }

  const syncEnabled = !!value && autoSync;
  const syncStore = storeRef.current;

  // Path sync: write only the sub-path. Full-state sync: merge whole storeState.
  // eslint-disable-next-line react-hooks/rules-of-hooks, @typescript-eslint/no-unsafe-argument
  useStoreSync(path as any, (path ? value : storeState) as any, { enabled: syncEnabled && !!path, store: syncStore });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useStoreSync<TState>(undefined, storeState as Partial<TState>, { enabled: syncEnabled && !path, store: syncStore });

  return <StoreContext value={storeRef.current}>{children}</StoreContext>;
};

export default StoreProvider;
