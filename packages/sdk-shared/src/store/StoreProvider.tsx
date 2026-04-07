/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, use, useRef } from 'react';

import createStore from './createStore';
import useStoreSync from './hooks/useStoreSync';

import type { StoreApi } from '../types';
import type { ReactNode } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreApi<any> | undefined>(undefined);

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  value?: Partial<TState>;
  inherit?: boolean;
  children?: ReactNode;
};

const StoreProvider = <TState extends object = any>({
  store,
  value,
  inherit = false,
  children
}: StoreProviderProps<TState>) => {
  const parentStore = use(StoreContext) as StoreApi<TState> | undefined;

  const storeRef = useRef<StoreApi<TState>>(undefined);

  if (!storeRef.current) {
    if (store) {
      storeRef.current = store;
    } else {
      const parentState = inherit && parentStore ? parentStore.getState() : {};
      storeRef.current = createStore<TState>(() => ({ ...parentState, ...(value ?? {}) }) as TState);
    }
  }

  useStoreSync<TState>(undefined, (value ?? {}) as Partial<TState>, { enabled: !!value, store: storeRef.current });

  return <StoreContext value={storeRef.current}>{children}</StoreContext>;
};

export default StoreProvider;
