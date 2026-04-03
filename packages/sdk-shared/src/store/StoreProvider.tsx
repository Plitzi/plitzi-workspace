/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext } from 'react';

import type { StoreApi } from '../types';
import type { ReactNode } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreApi<any> | undefined>(undefined);

export type StoreProviderProps<TState extends object = any> = {
  children?: ReactNode;
  store: StoreApi<TState>;
};

const StoreProvider = ({ store, children }: StoreProviderProps) => {
  return <StoreContext value={store}>{children}</StoreContext>;
};

export default StoreProvider;
