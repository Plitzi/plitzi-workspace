/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { useCallback } from 'react';

import { useResolvedStore } from './shared';

import type { PathOf, PathValue, SetFromBaseFn, SetStateFn, UseStoreSetterOptions } from '../../types/StoreTypes';

export type { SetFromBaseFn, SetStateFn, UseStoreSetterOptions };

function useStoreSetter<TState extends object>(options?: UseStoreSetterOptions<TState>): SetStateFn<TState>;

function useStoreSetter<TState extends object, P extends PathOf<TState>>(
  basePath: P,
  options?: UseStoreSetterOptions<TState>
): SetFromBaseFn<PathValue<TState, P>>;

function useStoreSetter<TState extends object>(
  arg?: string | UseStoreSetterOptions<TState>,
  options?: UseStoreSetterOptions<TState>
): any {
  const resolvedBasePath = typeof arg === 'string' ? arg : undefined;
  const resolvedOptions = typeof arg === 'object' ? arg : options;

  const store = useResolvedStore(resolvedOptions?.store, 'useStoreSetter');

  return useCallback(
    (subPath: string | undefined, value: unknown) => {
      if (resolvedBasePath === undefined) {
        store.setState(subPath as PathOf<TState>, value as any);
      } else if (subPath === undefined) {
        store.setState(resolvedBasePath as PathOf<TState>, value as any);
      } else {
        store.setState(`${resolvedBasePath}.${subPath}` as PathOf<TState>, value as any);
      }
    },
    [store, resolvedBasePath]
  );
}

export default useStoreSetter;
