/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { use, useCallback } from 'react';

import getByPath from '../helpers/getByPath';
import { StoreContext } from '../StoreProvider';

import type {
  __NoDefault,
  PathOf,
  PathValue,
  PathValues,
  StoreApi,
  StoreHookBaseOptions
} from '../../types/StoreTypes';

export type GetValueFn<TState extends object> = {
  (): TState;
  <P extends PathOf<TState>>(path: P): PathValue<TState, P>;
  <P extends PathOf<TState>, D>(path: P, opts: { defaultValue: D }): NonNullable<PathValue<TState, P>> | D;
  <D>(path: undefined, opts: { defaultValue: D }): NonNullable<TState> | D;
};

export type GetValueFromBaseFn<TBase> = TBase extends object
  ? {
      (): TBase;
      <SubP extends PathOf<TBase>>(path: SubP): PathValue<TBase, SubP>;
      <SubP extends PathOf<TBase>, D>(path: SubP, opts: { defaultValue: D }): NonNullable<PathValue<TBase, SubP>> | D;
      <D>(path: undefined, opts: { defaultValue: D }): NonNullable<TBase> | D;
    }
  : () => TBase;

export type GetValueFromBaseWithDefaultFn<TBase, D> = TBase extends object
  ? {
      (): NonNullable<TBase> | D;
      <SubP extends PathOf<NonNullable<TBase>>>(path: SubP): PathValue<NonNullable<TBase>, SubP>;
      <SubP extends PathOf<NonNullable<TBase>>, D2>(
        path: SubP,
        opts: { defaultValue: D2 }
      ): NonNullable<PathValue<NonNullable<TBase>, SubP>> | D2;
      <D2>(path: undefined, opts: { defaultValue: D2 }): NonNullable<TBase> | D2;
    }
  : () => NonNullable<TBase> | D;

export type GetValueMultiFn<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue = __NoDefault
> = () => PathValues<TState, Paths, TDefaultValue>;

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

// 4. Array paths, no default
function useStoreGetter<TState extends object, const Paths extends ReadonlyArray<PathOf<TState>>>(
  paths: Paths,
  options?: UseStoreGetterOptions<TState>
): GetValueMultiFn<TState, Paths>;

// 5. Array paths, per-element default array
function useStoreGetter<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
>(
  paths: Paths,
  options: UseStoreGetterOptions<TState, TDefaultValue> & { defaultValue: TDefaultValue }
): GetValueMultiFn<TState, Paths, TDefaultValue>;

// 6. Array paths, scalar default
function useStoreGetter<
  TState extends object,
  const Paths extends ReadonlyArray<PathOf<TState>>,
  const TDefaultValue extends PathValue<TState, Paths[number]>
>(
  paths: Paths,
  options: UseStoreGetterOptions<TState, TDefaultValue> & { defaultValue: TDefaultValue }
): GetValueMultiFn<TState, Paths, TDefaultValue>;

function useStoreGetter<TState extends object>(
  arg?: string | readonly string[] | UseStoreGetterOptions<TState>,
  options?: UseStoreGetterOptions<TState, any>
): (subPath?: string, opts?: { defaultValue?: unknown }) => any {
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

  return useCallback(
    (subPath?: string, opts?: { defaultValue?: unknown }): any => {
      const callDefault = opts?.defaultValue;
      const state = store.getState();

      if (resolvedPaths) {
        return resolvedPaths.map((p, i) => {
          const val = getByPath(state, p as PathOf<TState>);
          if (val !== undefined || defaultValue === undefined) {
            return val;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return Array.isArray(defaultValue) ? (defaultValue[i] ?? val) : defaultValue;
        });
      }

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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, resolvedBasePath, pathsKey, defaultValue]
  );
}

export default useStoreGetter;
