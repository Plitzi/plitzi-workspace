/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';

import { useResolvedStore } from './shared';

import type { PathOf, PathValue, SetFromBaseFn, SetStateFn, UseStoreSetterOptions } from '../../types';

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

  const store = useResolvedStore(resolvedOptions?.store, 'useStoreSetter', resolvedOptions?.storeId);

  return useMemo(
    () =>
      resolvedBasePath === undefined ? store.setState : store.withBase(resolvedBasePath as PathOf<TState>).setState,
    [store, resolvedBasePath]
  );
}

export default useStoreSetter;
