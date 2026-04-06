/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useRef } from 'react';

import createStore from './createStore';

import type { StoreApi } from '../types';
import type { ReactNode } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreApi<any> | undefined>(undefined);

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  value?: TState;
  children?: ReactNode;
};

const StoreProvider = <TState extends object = any>({ store, value, children }: StoreProviderProps<TState>) => {
  const storeRef = useRef(store ? store : createStore<TState>(() => (value ? value : {})));

  // const { useStoreSync } = createStoreHook<TState>();
  // useStoreSync(undefined, value, { enabled: !!value });

  return <StoreContext value={storeRef.current}>{children}</StoreContext>;
};

export default StoreProvider;
