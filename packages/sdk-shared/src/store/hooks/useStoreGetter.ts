/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useMemo } from 'react';

import { useResolvedStore } from './shared';
import getByPath from '../helpers/getByPath';

import type { __NoDefault, PathOf, PathValue, StoreHookBaseOptions } from '../../types/StoreTypes';

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

// A getter for a single path-or-selector entry in a multi-path call.
// - string path → GetValueFromBaseFn<PathValue<TState, P>>
// - selector fn → (() => ReturnType) with optional sub-path navigation
type EntryGetter<TState extends object, Entry> =
  Entry extends PathOf<TState>
    ? GetValueFromBaseFn<PathValue<TState, Entry>>
    : Entry extends (state: TState) => infer R
      ? R extends object
        ? GetValueFromBaseFn<R>
        : () => R
      : never;

export type GetterTuple<
  TState extends object,
  Entries extends ReadonlyArray<PathOf<TState> | ((state: TState) => unknown)>
> = {
  [K in keyof Entries]: EntryGetter<TState, Entries[K]>;
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

// 4. Array of paths and/or selectors — returns tuple of individual getters
function useStoreGetter<
  TState extends object,
  const Entries extends ReadonlyArray<PathOf<TState> | ((state: TState) => unknown)>
>(entries: Entries, options?: UseStoreGetterOptions<TState>): GetterTuple<TState, Entries>;

function useStoreGetter<TState extends object>(
  arg?: string | readonly (string | ((state: TState) => unknown))[] | UseStoreGetterOptions<TState>,
  options?: UseStoreGetterOptions<TState, any>
): any {
  const resolvedBasePath = typeof arg === 'string' ? arg : undefined;
  const resolvedEntries = Array.isArray(arg) ? (arg as readonly (string | ((state: TState) => unknown))[]) : undefined;
  const resolvedOptions: UseStoreGetterOptions<TState, any> | undefined =
    typeof arg === 'object' && !Array.isArray(arg) ? (arg as UseStoreGetterOptions<TState, any>) : options;

  const store = useResolvedStore(resolvedOptions?.store, 'useStoreGetter');
  const { defaultValue } = resolvedOptions ?? {};
  const entriesKey = resolvedEntries?.map(e => (typeof e === 'function' ? e.toString() : e)).join('|');

  return useMemo(
    () => {
      if (resolvedEntries) {
        return resolvedEntries.map(entry => (subPath?: string, callDefault?: unknown): any => {
          const base =
            typeof entry === 'function'
              ? entry(store.getState())
              : getByPath(store.getState(), entry as PathOf<TState>);

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
    [store, resolvedBasePath, entriesKey, defaultValue]
  );
}

export default useStoreGetter;
