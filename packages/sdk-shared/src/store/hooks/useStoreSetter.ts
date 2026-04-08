/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { useCallback } from 'react';

import { useResolvedStore } from './shared';

import type { PathOf, PathValue, StoreHookBaseOptions } from '../../types/StoreTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UseStoreSetterOptions<TState extends object = object> = StoreHookBaseOptions<TState>;

/**
 * Setter returned when no base path is provided.
 * Mirrors SetState<TState> directly.
 */
export type SetStateFn<TState extends object> = {
  (path: undefined, value: TState | ((prev: TState) => TState)): void;
  <P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
  ): void;
};

/**
 * Setter scoped to a base path.
 * Sub-path is appended to the base path before calling store.setState.
 *
 * setFlat(`${id}.attributes`, val)  →  store.setState(`schema.flat.${id}.attributes`, val)
 * setFlat(id, val)                  →  store.setState(`schema.flat.${id}`, val)
 * setFlat(undefined, val)           →  store.setState('schema.flat', val)
 */
export type SetFromBaseFn<TBase> = TBase extends object
  ? {
      (subPath: undefined, value: TBase | ((prev: TBase) => TBase)): void;
      <SubP extends PathOf<TBase>>(
        subPath: SubP,
        value: PathValue<TBase, SubP> | ((prev: PathValue<TBase, SubP>) => PathValue<TBase, SubP>)
      ): void;
    }
  : (subPath: undefined, value: TBase) => void;

// ─── Overloads ────────────────────────────────────────────────────────────────

// 1. No base path — returns full setState
function useStoreSetter<TState extends object>(options?: UseStoreSetterOptions<TState>): SetStateFn<TState>;

// 2. Base path — returns scoped setter
function useStoreSetter<TState extends object, P extends PathOf<TState>>(
  basePath: P,
  options?: UseStoreSetterOptions<TState>
): SetFromBaseFn<PathValue<TState, P>>;

// ─── Implementation ───────────────────────────────────────────────────────────

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
