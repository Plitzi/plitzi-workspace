import type { Dispatch, SetStateAction } from 'react';

export type StateManagerContextValue = {
  state: Record<string, unknown>;
  setState: Dispatch<SetStateAction<Record<string, unknown>>>;
  setStateByKey: (key: string, value: unknown, storeMode?: 'localStorage' | 'sessionStorage') => void;
  clearCache: (storeMode?: 'localStorage' | 'sessionStorage') => void;
};
