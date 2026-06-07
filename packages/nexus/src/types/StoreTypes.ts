/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type PathTrie from '../createStore/helpers/PathTrie';
import type Subscribers from '../createStore/helpers/Subscribers';

export type Path = string;

export type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type PathOf<T, Seen = never> = T extends Primitive
  ? never
  : T extends Seen
    ? never
    : {
        [K in keyof T & string]-?: T[K] extends Primitive
          ? K
          : T[K] extends Array<infer U>
            ? K | `${K}.${number}` | `${K}.${number}.${PathOf<U, Seen | T>}`
            : K | `${K}.${PathOf<T[K], Seen | T>}`;
      }[keyof T & string];

export type PathValue<T, P> = T extends undefined
  ? undefined
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof NonNullable<T>
      ? NonNullable<T>[K] extends Array<infer U>
        ? Rest extends `${number}.${infer R}`
          ? PathValue<U, R>
          : Rest extends `${number}`
            ? U
            : never
        : PathValue<NonNullable<T>[K], Rest>
      : never
    : P extends keyof NonNullable<T>
      ? NonNullable<T>[P]
      : never;

export type PathSetter<TState extends object, P extends PathOf<TState>> = (
  value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
) => void;

export type __NoDefault = { __noDefault: true };

type NumericIndex<I> = I extends `${infer N extends number}` ? N : I extends number ? I : never;

export type PathValues<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  DefaultValue = __NoDefault
> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState>
    ? [DefaultValue] extends [__NoDefault]
      ? PathValue<TState, Paths[I]>
      : DefaultValue extends readonly any[]
        ? NumericIndex<I> extends infer NI
          ? NI extends keyof DefaultValue
            ? DefaultValue[NI] extends undefined
              ? PathValue<TState, Paths[I]> | undefined
              : NonNullable<PathValue<TState, Paths[I]>> | DefaultValue[NI]
            : PathValue<TState, Paths[I]>
          : never
        : NonNullable<PathValue<TState, Paths[I]>> | DefaultValue
    : never;
};

export type PathSetters<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathSetter<TState, Paths[I]> : never;
};

export type SyncMode = 'mount' | 'sync';

export type StoreHookBaseOptions<TState extends object = object> = {
  // Target a specific store instead of the nearest provider: pass `store` directly, or `storeId` to resolve a named
  // ancestor store from the registry (reachable even across a disconnected provider). `store` wins if both are given.
  store?: StoreApi<TState>;
  storeId?: string;
};

export type StoreHookReactiveOptions<T, TState extends object = object> = StoreHookBaseOptions<TState> & {
  mode?: SyncMode;
  enabled?: boolean;
  equalityFn?: (a: T, b: T) => boolean;
};

// A committed write: the changed path (undefined for a full-state replace) and the own-state snapshots around it.
export type StoreChange<T> = { path: PathOf<T> | undefined; prev: T; next: T };

// Observer of committed changes — the substrate logger, history and persist all ride on. Returned by a middleware.
export type ChangeListener<T> = (change: StoreChange<T>) => void;

// Returned from a `beforeChange` interceptor to abort the write entirely: nothing is committed, no observers fire.
export const CANCEL: unique symbol = Symbol('@plitzi/nexus/cancel');

// The write a `beforeChange` interceptor sees before it commits. `value` is the resolved value about to be written
// at `path` (the leaf value, or the whole next state when `path` is undefined); `prev` is the current value there.
export type WriteContext<T> = {
  path: PathOf<T> | undefined;
  value: unknown;
  prev: unknown;
};

// Runs before a write commits. Return a value to REPLACE what gets written, `CANCEL` to abort it, or nothing to let
// it through unchanged. Interceptors from several middlewares run in array order, each seeing the previous result.
export type WriteInterceptor<T> = (context: WriteContext<T>) => unknown;

// A failure thrown by any middleware handler or subscriber during a write, surfaced to every registered `onError`.
export type StoreError<T> = {
  error: unknown;
  phase: 'beforeChange' | 'onChange' | 'notify';
  path: PathOf<T> | undefined;
};

export type StoreErrorHandler<T> = (failure: StoreError<T>) => void;

// Routes a failure to the registered `onError` handlers, or re-throws it when none exist so it is never swallowed.
export type StoreErrorReporter<T> = (
  error: unknown,
  phase: StoreError<T>['phase'],
  path: PathOf<T> | undefined
) => void;

export type StoreMiddlewareHandlers<T> = {
  // Intercept/transform/cancel a write before it commits. Runs before `onChange` and before subscribers wake.
  beforeChange?: WriteInterceptor<T>;
  onChange?: ChangeListener<T>;
  // Notified when another handler or subscriber throws, so a logger can record the failure instead of it being lost.
  onError?: StoreErrorHandler<T>;
  // Runs after React hydration (client-side) to restore persisted state. In SSR this is deferred and never runs,
  // preventing hydration mismatches. For standalone (non-Provider) usage, it runs synchronously during createStore.
  hydrate?: (api: StoreApi<T>) => void;
};

// Set up once after the store is created (the body may hydrate via `api.setState`). Returns the change handler to
// register, or nothing for a pure side-effect middleware.
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type StoreMiddleware<T extends object> = (api: StoreApi<T>) => StoreMiddlewareHandlers<T> | void;

// The changed path is forwarded so scope-chain listeners can skip wakes for paths a parent change doesn't touch.
// Consumer listeners (React `onStoreChange`) simply ignore the argument.
export type Listener = (changedPath?: Path) => void;

export type SetState<T> = {
  (path: undefined, value: T | ((prev: T) => T), canPropagate?: boolean): void;
  <P extends PathOf<T>>(
    path: P,
    value: PathValue<T, P> | ((prev: PathValue<T, P>) => PathValue<T, P>),
    canPropagate?: boolean
  ): void;
};

export type GetState<T> = () => T;

export type StoreApi<T> = {
  // Optional identity for this store. Set via `createStore(init, { id })` or the `<StoreProvider id>` prop; lets a
  // descendant target this store by id (see the `storeId` hook option) and aids logging/devtools.
  id?: string;
  getState: GetState<T>;
  // Resolves a single path through the scope chain without materializing the full merged state — own value
  // shadows the parent's, except where both are objects (then the subtree at that path is deep-merged).
  getPath: <P extends PathOf<T>>(path: P) => PathValue<T, P> | undefined;
  setState: SetState<T>;
  // Runs `fn`, coalescing every `setState` inside it into one wake pass: subscribers re-render once at the end
  // instead of once per write (reads inside `fn` still see each write immediately). Change observers — logger,
  // history, persist — keep firing per write. Nestable: only the outermost `batch` flushes.
  batch: <R>(fn: () => R) => R;
  subscribe: (listener: Listener) => () => void;
  subscribePath: <P extends PathOf<T>>(path: P, listener: Listener) => () => void;
  // Observe every committed change with its before/after snapshots. The substrate for logger, history and persist.
  subscribeChange: (listener: ChangeListener<T>) => () => void;
  destroy?: () => void;
  // Re-attaches a scoped store's parent subscription after a `destroy()` (no-op for root stores or when already
  // attached). Lets a provider survive React StrictMode's mount → unmount → remount, which reuses the store
  // instance: without it, the simulated unmount detaches the live parent link and it is never restored.
  reconnect?: () => void;
  // Subscribe to cache-invalidation events from this store's silent (`canPropagate: false`) commits. Those writes
  // deliberately skip subscriber wakes, so a scoped child can't learn of them through `subscribe` — but it must
  // still invalidate cached reads. The child registers here; the event then cascades down the chain. Propagating
  // changes need no such channel — they already reach children through `subscribe`. Optional: absent on stores that
  // predate it, in which case silent ancestor writes simply aren't cache-invalidated downstream.
  subscribeInvalidate?: (listener: () => void) => () => void;
  // Runs middleware hydrate handlers (e.g., restore persisted state from localStorage). Called automatically
  // after mount by StoreProvider; can be called manually for standalone stores.
  hydrate?: () => void;
};

export type StoreApiInternal<T> = StoreApi<T> & {
  listeners: Subscribers<Listener>;
  pathListeners: PathTrie;
  changeListeners: Subscribers<ChangeListener<T>>;
  interceptors: WriteInterceptor<T>[];
  errorHandlers: StoreErrorHandler<T>[];
  // Test-only metric: number of times `getState` recomputed the full deep-merge (cache miss).
  getMergeCount?: () => number;
};

export type PathOrFn<TState extends object> = PathOf<TState> | ((state: TState) => PathOf<TState>);

export type PathOrFnValue<TState extends object, Entry> =
  Entry extends PathOf<TState>
    ? PathValue<TState, Entry>
    : Entry extends (state: TState) => infer P
      ? P extends PathOf<TState>
        ? PathValue<TState, P>
        : unknown
      : unknown;

export type PathOrFnValues<TState extends object, Entries extends ReadonlyArray<PathOrFn<TState>>> = {
  [I in keyof Entries]: PathOrFnValue<TState, Entries[I]>;
};

export type PathOrFnSetter<TState extends object, Entry> =
  Entry extends PathOf<TState>
    ? PathSetter<TState, Entry>
    : Entry extends (state: TState) => infer P
      ? P extends PathOf<TState>
        ? PathSetter<TState, P>
        : (value: unknown) => void
      : (value: unknown) => void;

export type PathOrFnSetters<TState extends object, Entries extends ReadonlyArray<PathOrFn<TState>>> = {
  [I in keyof Entries]: PathOrFnSetter<TState, Entries[I]>;
};

export type MultiPathReturn<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue = __NoDefault
> = [PathValues<TState, Paths, TDefaultValue>, ...PathSetters<TState, Paths>];

export type UseStoreReturn<TState extends object, TArg> =
  TArg extends PathOf<TState>
    ? [PathValue<TState, TArg>, PathSetter<TState, TArg>]
    : TArg extends (state: TState) => unknown
      ? [unknown, (value: unknown) => void]
      : [TState, StoreApi<TState>['setState']];

export type UseStoreOptions<T, TState extends object = object> = StoreHookReactiveOptions<T, TState> & {
  defaultValue?: NonNullable<T>;
  transformer?: (value: T) => unknown;
};

export type UseStoreMultiOptions<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue extends
    | readonly (PathValue<TState, Paths[number]> | undefined)[]
    | PathValue<TState, Paths[number]>
    | undefined = undefined
> = Omit<StoreHookReactiveOptions<never, TState>, 'equalityFn'> & {
  equalityFn?: (a: PathValues<TState, Paths>, b: PathValues<TState, Paths>) => boolean;
  defaultValue?: TDefaultValue;
  transformer?: (values: PathValues<TState, Paths>) => unknown;
};

export type UseStoreSyncOptions<T, TState extends object = object> = StoreHookReactiveOptions<T, TState> & {
  syncStrategy?: 'render' | 'afterRender';
};

export type UseStoreSyncMultiOptions<TState extends object = object> = Omit<
  StoreHookReactiveOptions<never, TState>,
  'equalityFn'
> & {
  syncStrategy?: 'render' | 'afterRender';
};

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

export type SetStateFn<TState extends object> = {
  (path: undefined, value: TState | ((prev: TState) => TState)): void;
  <P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
  ): void;
};

export type SetFromBaseFn<TBase> = TBase extends object
  ? {
      (subPath: undefined, value: TBase | ((prev: TBase) => TBase)): void;
      <SubP extends PathOf<TBase>>(
        subPath: SubP,
        value: PathValue<TBase, SubP> | ((prev: PathValue<TBase, SubP>) => PathValue<TBase, SubP>)
      ): void;
    }
  : (subPath: undefined, value: TBase) => void;

export type UseStoreSetterOptions<TState extends object = object> = StoreHookBaseOptions<TState>;
