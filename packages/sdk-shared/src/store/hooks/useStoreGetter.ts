/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { use, useMemo } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type { __NoDefault, PathOf, PathValue, StoreApi, StoreHookBaseOptions } from '../../types/StoreTypes';

export type GetValueFn<TState extends object> = {
  (): TState;
  <P extends PathOf<TState>>(path: P): PathValue<TState, P>;
  <P extends PathOf<TState>, D>(path: P, defaultValue: D): NonNullable<PathValue<TState, P>> | D;
  <D>(path: undefined, defaultValue: D): NonNullable<TState> | D;
};

export type GetValueFromBaseFn<TBase> = TBase extends object
  ? {
      (): TBase;
      <SubP extends PathOf<TBase>>(path: SubP): PathValue<TBase, SubP>;
      <SubP extends PathOf<TBase>, D>(path: SubP, defaultValue: D): NonNullable<PathValue<TBase, SubP>> | D;
      <D>(path: undefined, defaultValue: D): NonNullable<TBase> | D;
    }
  : () => TBase;

export type GetValueFromBaseWithDefaultFn<TBase, D> = TBase extends object
  ? {
      (): NonNullable<TBase> | D;
      <SubP extends PathOf<NonNullable<TBase>>>(path: SubP): PathValue<NonNullable<TBase>, SubP>;
      <SubP extends PathOf<NonNullable<TBase>>, D2>(
        path: SubP,
        defaultValue: D2
      ): NonNullable<PathValue<NonNullable<TBase>, SubP>> | D2;
      <D2>(path: undefined, defaultValue: D2): NonNullable<TBase> | D2;
    }
  : () => NonNullable<TBase> | D;

export type GetterTuple<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [K in keyof Paths]: Paths[K] extends PathOf<TState> ? GetValueFromBaseFn<PathValue<TState, Paths[K]>> : never;
};

export type UseStoreGetterOptions<TState extends object = object, D = __NoDefault> = StoreHookBaseOptions<TState> & {
  defaultValue?: D;
};

// 1. No base path
function useStoreGetter<TState extends object>(options?: UseStoreGetterOptions<TState>): GetValueFn<TState>;

// 2. Base path, no default
function useStoreGetter<TState extends object, P extends PathOf<TState>>(
  basePath: P,
  options?: UseStoreGetterOptions<TState>
): GetValueFromBaseFn<PathValue<TState, P>>;

// 3. Base path, with default
function useStoreGetter<TState extends object, P extends PathOf<TState>, D>(
  basePath: P,
  options: UseStoreGetterOptions<TState, D> & { defaultValue: D }
): GetValueFromBaseWithDefaultFn<PathValue<TState, P>, D>;

// 4. Array paths — returns tuple of individual getters
function useStoreGetter<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options?: UseStoreGetterOptions<TState>
): GetterTuple<TState, Paths>;

function useStoreGetter<TState extends object>(
  arg?: string | readonly string[] | UseStoreGetterOptions<TState>,
  options?: UseStoreGetterOptions<TState, any>
): any {
  const resolvedBasePath = typeof arg === 'string' ? arg : undefined;
  const resolvedPaths = Array.isArray(arg) ? arg : undefined;
  const resolvedOptions: UseStoreGetterOptions<TState, any> | undefined =
    typeof arg === 'object' && !Array.isArray(arg) ? (arg as UseStoreGetterOptions<TState, any>) : options;

  const contextStore = use(StoreContext) as StoreApi<TState> | undefined;
  const store = resolvedOptions?.store ?? contextStore;
  if (!store) {
    throw new Error('useStoreGetter must be used inside a StoreProvider');
  }

  const { defaultValue } = resolvedOptions ?? {};
  const pathsKey = resolvedPaths?.join('|');

  return useMemo(
    () => {
      if (resolvedPaths) {
        return resolvedPaths.map(p => (subPath?: string, callDefault?: unknown): any => {
          const base = getByPath(store.getState(), p as PathOf<TState>);
          if (subPath !== undefined) {
            const subVal = getByPath(base as TState, subPath as PathOf<TState>);
            return subVal === undefined && callDefault !== undefined ? callDefault : subVal;
          }

          return base === undefined && callDefault !== undefined ? callDefault : base;
        });
      }

      return (subPath?: string, callDefault?: unknown): any => {
        const state = store.getState();

        if (resolvedBasePath !== undefined) {
          const base = getByPath(state, resolvedBasePath as PathOf<TState>);
          if (subPath !== undefined) {
            const subVal = getByPath(base as TState, subPath as PathOf<TState>);
            return subVal === undefined && callDefault !== undefined ? callDefault : subVal;
          }

          const baseDefault = callDefault !== undefined ? callDefault : defaultValue;
          return base === undefined && baseDefault !== undefined ? baseDefault : base;
        }

        if (subPath !== undefined) {
          const val = getByPath(state, subPath as PathOf<TState>);
          return val === undefined && callDefault !== undefined ? callDefault : val;
        }

        return state;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, resolvedBasePath, pathsKey, defaultValue]
  );
}

export default useStoreGetter;
