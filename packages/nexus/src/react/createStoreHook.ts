/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import useStoreBase from './hooks/useStore';
import useStoreGetterBase from './hooks/useStoreGetter';
import useStoreSetterBase from './hooks/useStoreSetter';
import useStoreSyncBase from './hooks/useStoreSync';

import type {
  GetterTuple,
  GetValueFn,
  GetValueFromBaseFn,
  MultiPathReturn,
  PathOf,
  PathOrFn,
  PathOrFnSetters,
  PathOrFnValues,
  PathSetters,
  PathSetter,
  PathValue,
  PathValues,
  SetFromBaseFn,
  SetStateFn,
  StoreApi,
  UseStoreGetterOptions,
  UseStoreMultiOptions,
  UseStoreOptions,
  UseStoreSetterOptions,
  UseStoreSyncMultiOptions,
  UseStoreSyncOptions
} from '../types';

export const createStoreHook = <TState extends object>() => {
  function useStore(options?: UseStoreOptions<TState, TState>): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { transformer?: never }
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, TResult>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void];

  function useStore<P extends PathOf<TState>>(
    pathFn: (state: TState) => P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { transformer?: never }
  ): [PathValue<TState, P>, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>, TResult>(
    pathFn: (state: TState) => P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, PathSetter<TState, P>];

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: Omit<UseStoreMultiOptions<TState, Paths>, 'transformer'>
  ): MultiPathReturn<TState, Paths>;

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>, TResult>(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths> & { transformer: (values: PathValues<TState, Paths>) => TResult }
  ): [TResult, ...PathSetters<TState, Paths>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>>(
    paths: Entries,
    options?: Omit<UseStoreMultiOptions<TState, any>, 'transformer'> & { transformer?: never }
  ): [PathOrFnValues<TState, Entries>, ...PathOrFnSetters<TState, Entries>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>, TResult>(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'transformer'> & {
      transformer: (values: PathOrFnValues<TState, Entries>) => TResult;
    }
  ): [TResult, ...PathOrFnSetters<TState, Entries>];

  function useStore(arg?: any, options?: any): unknown {
    return useStoreBase(arg, options);
  }

  function useStoreSync(
    path: undefined,
    value: TState | Partial<TState>,
    options?: UseStoreSyncOptions<TState, TState>
  ): void;

  function useStoreSync<P extends PathOf<TState>>(
    path: P | ((state: TState) => P),
    value: PathValue<TState, P>,
    options?: UseStoreSyncOptions<PathValue<TState, P>, TState>
  ): void;

  function useStoreSync<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    values: PathValues<TState, Paths>,
    options?: UseStoreSyncMultiOptions<TState>
  ): void;

  function useStoreSync(
    paths: ReadonlyArray<PathOrFn<TState>>,
    values: readonly unknown[],
    options?: UseStoreSyncMultiOptions<TState>
  ): void;

  function useStoreSync(pathOrPaths: any, value: any, options?: any): void {
    useStoreSyncBase<TState, PathOf<TState>>(pathOrPaths, value, options);
  }

  function useStoreGetter(options?: UseStoreGetterOptions<TState>): GetValueFn<TState>;

  function useStoreGetter<P extends PathOf<TState>>(
    basePath: P,
    options?: UseStoreGetterOptions<TState>
  ): GetValueFromBaseFn<PathValue<TState, P>>;

  function useStoreGetter<const Entries extends ReadonlyArray<PathOf<TState> | ((state: TState) => unknown)>>(
    entries: Entries,
    options?: UseStoreGetterOptions<TState>
  ): GetterTuple<TState, Entries>;

  function useStoreGetter(arg?: any, options?: any): unknown {
    return (useStoreGetterBase as (a?: any, b?: any) => unknown)(arg, options);
  }

  function useStoreSetter(options?: UseStoreSetterOptions<TState>): SetStateFn<TState>;

  function useStoreSetter<P extends PathOf<TState>>(
    basePath: P,
    options?: UseStoreSetterOptions<TState>
  ): SetFromBaseFn<PathValue<TState, P>>;

  function useStoreSetter(arg?: any, options?: any): unknown {
    return (useStoreSetterBase as (a?: any, b?: any) => unknown)(arg, options);
  }

  return { useStore, useStoreSync, useStoreGetter, useStoreSetter };
};

export default createStoreHook;
