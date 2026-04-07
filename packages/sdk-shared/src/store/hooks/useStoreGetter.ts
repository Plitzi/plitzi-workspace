/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { use, useCallback } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { PathOf, PathValue, StoreApi } from '../../types/StoreTypes';

export type GetValueFn<TState extends object> = {
  (): TState;
  <P extends PathOf<TState>>(path: P): PathValue<TState, P>;
};

export type GetValueFromBaseFn<TBase> = TBase extends object
  ? {
      (): TBase;
      <SubP extends PathOf<TBase>>(path: SubP): PathValue<TBase, SubP>;
    }
  : () => TBase;

function useStoreGetter<TState extends object>(): GetValueFn<TState>;

function useStoreGetter<TState extends object, P extends PathOf<TState>>(
  basePath: P
): GetValueFromBaseFn<PathValue<TState, P>>;

function useStoreGetter<TState extends object, P extends PathOf<TState>>(basePath?: P): (subPath?: string) => any {
  const store = use(StoreContext) as StoreApi<TState> | undefined;
  if (!store) {
    throw new Error('useStoreGetter must be used inside a StoreProvider');
  }

  return useCallback(
    (subPath?: string): any => {
      const state = store.getState();
      if (basePath !== undefined) {
        const base = getByPath(state, basePath) as any;

        return subPath !== undefined ? getByPath(base, subPath as PathOf<TState>) : base;
      }

      return subPath !== undefined ? getByPath(state, subPath as PathOf<TState>) : state;
    },
    [store, basePath]
  );
}

export default useStoreGetter;
