import type { Dispatch, SetStateAction } from 'react';

export type StateManagerContextValue = {
  state: Record<string, unknown>;
  setState: Dispatch<SetStateAction<Record<string, unknown>>>;
  setStateByKey: (key: string, value: unknown, storeMode?: string) => void;
  clearCache: (storeMode?: string) => void;
};
