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

const StoreProviderInner = <TState extends object>({
  value,
  children
}: {
  value?: Partial<TState>;
  children?: ReactNode;
}) => {
  useStoreSync<TState>(undefined, (value ?? {}) as Partial<TState>, { enabled: !!value });

  return <>{children}</>;
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
      // Point 1: if inherit, seed child store with parent state + value override
      const parentState = inherit && parentStore ? parentStore.getState() : {};
      storeRef.current = createStore<TState>(() => ({ ...parentState, ...(value ?? {}) }) as TState);
    }
  }

  return (
    <StoreContext value={storeRef.current}>
      <StoreProviderInner<TState> value={value}>{children}</StoreProviderInner>
    </StoreContext>
  );
};

export default StoreProvider;
