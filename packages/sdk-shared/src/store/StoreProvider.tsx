/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { pick } from '@plitzi/plitzi-ui/helpers/lodash';
import { createContext, use, useMemo, useRef } from 'react';

import createStore from './createStore';
import useStoreSync from './hooks/useStoreSync';

import type { StoreApi, StoreLogger } from '../types';
import type { ReactNode } from 'react';

const StoreContext = createContext<StoreApi<any> | undefined>(undefined);
StoreContext.displayName = 'StoreContext';

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  path?: string;
  value?: Partial<TState> | ((state: TState) => TState);
  /** true = inherit all parent keys, string[] = inherit only listed keys */
  inherit?: boolean | ReadonlyArray<keyof TState>;
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
    let parentState = {} as TState;
    if (inherit && parentStore) {
      const fullState = parentStore.getState();
      if (inherit === true) {
        parentState = fullState;
      } else if (Array.isArray(inherit)) {
        parentState = pick(fullState as Record<keyof TState, unknown>, inherit);
      }
    }

    return typeof value === 'function' ? value(parentState) : { ...parentState, ...value };
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
  useStoreSync(path as any, (path ? value : storeState) as any, {
    enabled: syncEnabled && !!path,
    store: syncStore,
    canListen: !!store
  });
  useStoreSync<TState>(undefined, storeState as Partial<TState>, {
    enabled: syncEnabled && !path,
    store: syncStore,
    canListen: !!store
  });

  return <StoreContext value={storeRef.current}>{children}</StoreContext>;
};

export { StoreContext };

export default StoreProvider;
