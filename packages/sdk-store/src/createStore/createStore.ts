/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import { createChainReads } from './helpers/createChainReads';
import { createSetState } from './helpers/createSetState';
import { forwardParentChanges } from './helpers/forwardParentChanges';
import PathTrie from './helpers/PathTrie';
import { createScopeClaims } from './helpers/scopeCollisions';
import Subscribers from './helpers/Subscribers';
import useStoreBase from './hooks/useStore';
import useStoreGetterBase from './hooks/useStoreGetter';
import useStoreSetterBase from './hooks/useStoreSetter';
import useStoreSyncBase from './hooks/useStoreSync';

import type {
  ChangeListener,
  GetState,
  GetterTuple,
  GetValueFn,
  GetValueFromBaseFn,
  GetValueFromBaseWithDefaultFn,
  Listener,
  MultiPathReturn,
  PathOf,
  PathOrFn,
  PathOrFnSetters,
  PathOrFnValue,
  PathOrFnValues,
  PathSetters,
  PathSetter,
  PathValue,
  PathValues,
  SetFromBaseFn,
  SetState,
  SetStateFn,
  StoreApi,
  StoreApiInternal,
  StoreErrorHandler,
  StoreErrorReporter,
  StoreMiddleware,
  UseStoreGetterOptions,
  UseStoreMultiOptions,
  UseStoreOptions,
  UseStoreSetterOptions,
  UseStoreSyncMultiOptions,
  UseStoreSyncOptions,
  WriteInterceptor
} from '../types';
import type { ScopeClaims } from './helpers/scopeCollisions';

// Identifies each scope for dev-only sibling-collision detection.
let scopeIdSeq = 0;

// A parent exposes its claims registry to children through this dev-only shape (kept off the public StoreApi).
type WithScopeClaims = { scopeClaims?: ScopeClaims };

function createStore<TState extends object>(
  initializer: Partial<TState> | ((set: SetState<TState>, get: GetState<TState>) => Partial<TState>),
  storeOptions?: { parent?: StoreApi<TState>; middlewares?: StoreMiddleware<TState>[] }
): StoreApi<TState> {
  // `state` is the live, private working copy and is never handed out. `ownSnapshot` is the immutable view
  // `getState` returns: a lazy `{ ...state }` clone, cleared on every change so its reference doubles as the change
  // signal. Because every snapshot is a distinct clone, mutating `state` in place can't corrupt one a consumer holds.
  let state = {} as TState;
  let ownSnapshot: TState | undefined;
  const listeners = new Subscribers<Listener>();
  const changeListeners = new Subscribers<ChangeListener<TState>>();
  const pathListeners = new PathTrie();
  // Scoped children register here to be told of this store's silent (`canPropagate: false`) commits, which skip the
  // normal subscriber wakes. The event only invalidates cached reads downstream; it never re-renders anyone.
  const invalidateListeners = new Subscribers<() => void>();
  const invalidateDescendants = (): void => {
    invalidateListeners.forEach(cb => cb());
  };
  const interceptors: WriteInterceptor<TState>[] = [];
  const errorHandlers: StoreErrorHandler<TState>[] = [];
  const parent = storeOptions?.parent;
  const scopeId = ++scopeIdSeq;

  // A middleware handler or subscriber that throws is routed here: to every `onError` handler (a logger records it),
  // or re-thrown when none are registered so the failure is never silently swallowed.
  const reportError: StoreErrorReporter<TState> = (error, phase, path) => {
    if (errorHandlers.length === 0) {
      throw error;
    }

    const failure = { error, phase, path };
    for (let i = 0, n = errorHandlers.length; i < n; i++) {
      errorHandlers[i](failure);
    }
  };

  const getOwnState = () => state;
  const getOwnSnapshot = (): TState => (ownSnapshot ??= { ...state });

  const {
    getState,
    getPath,
    invalidate: invalidateReads,
    setActive: setReadCacheActive,
    getMergeCount
  } = createChainReads<TState>(getOwnState, getOwnSnapshot, parent);
  // A scoped store starts detached (no subscribers yet) — so its read caches are inactive until it attaches.
  if (parent) {
    setReadCacheActive(false);
  }
  const { setState, batch } = createSetState<TState>({
    getOwnState,
    getOwnSnapshot,
    setOwnState: next => {
      state = next;
      ownSnapshot = undefined;
      invalidateReads();
    },
    mutateOwnKey: (key, value) => {
      (state as Record<string, unknown>)[key] = value;
      invalidateReads();
      ownSnapshot = undefined;
    },
    parent,
    listeners,
    pathListeners,
    changeListeners,
    interceptors,
    reportError,
    invalidateDescendants,
    onDelegateToParent:
      import.meta.env.MODE !== 'production' && parent
        ? path => (parent as WithScopeClaims).scopeClaims?.claimDelegatedWrite(path, scopeId)
        : undefined
  });

  // A silent ancestor commit can't reach us through `subscribe`, so the parent tells us directly: invalidate our
  // cached reads and relay the event to our own scoped children.
  const onSilentAncestorChange = (): void => {
    invalidateReads();
    invalidateDescendants();
  };

  // Lazy attachment: a scoped store only subscribes to its parent's changes while something actually watches them.
  // A child's forwarder is itself a `parent.subscribe`, so it shows up in `listeners` — meaning a non-empty
  // `listeners`/`pathListeners`/`changeListeners` already captures "a direct subscriber, or a descendant via its
  // forwarder". Attaching/detaching on that boolean therefore connects exactly the branches from a subscriber up to
  // the root, and a write cascades only down those (O(depth-to-subscriber)) instead of every scope (O(total)). The
  // root has no parent and is never attached.
  let forwarder: { unsubscribe: () => void; seedBaseline: () => void } | undefined;
  let invalidateUnsub: (() => void) | undefined;
  // `destroy()` tears the scope down for good — it won't silently re-attach on a later subscribe; only `reconnect()`
  // (the StrictMode remount path) revives it.
  let destroyed = false;

  const hasInterest = (): boolean => listeners.length > 0 || pathListeners.size > 0 || changeListeners.length > 0;

  const attach = (): void => {
    if (forwarder || !parent) {
      return;
    }

    // The parent may have changed while detached, so invalidate cached reads and resume caching on attach.
    invalidateReads();
    setReadCacheActive(true);
    forwarder = forwardParentChanges(
      parent,
      listeners,
      pathListeners,
      changeListeners,
      getState,
      reportError,
      invalidateReads
    );
    invalidateUnsub = parent.subscribeInvalidate?.(onSilentAncestorChange);
    if (changeListeners.length > 0) {
      forwarder.seedBaseline();
    }
  };

  const detach = (): void => {
    if (!forwarder) {
      return;
    }

    forwarder.unsubscribe();
    forwarder = undefined;
    invalidateUnsub?.();
    invalidateUnsub = undefined;
    setReadCacheActive(false);
  };

  // Re-evaluated whenever a subscriber is added or removed. Because a child's forwarder is a `parent.subscribe`,
  // (de)attaching here ripples up the chain through each parent's own `subscribe`/unsubscribe automatically.
  const syncAttachment = (): void => {
    if (!parent) {
      return;
    }

    if (!destroyed && hasInterest()) {
      attach();
    } else {
      detach();
    }
  };

  // Every subscription drives lazy attachment: adding the first subscriber attaches this scope to its parent, and
  // removing the last detaches it (see `syncAttachment`). `tracked` wraps a raw unsubscribe with that bookkeeping.
  const tracked = (unsubscribe: () => void): (() => void) => {
    syncAttachment();

    return () => {
      unsubscribe();
      syncAttachment();
    };
  };

  const subscribe = (listener: Listener) => tracked(listeners.add(listener));
  const subscribePath = <P extends PathOf<TState>>(path: P, listener: Listener) =>
    tracked(pathListeners.add(path, listener));
  const subscribeChange = (listener: ChangeListener<TState>) => {
    const untrack = tracked(changeListeners.add(listener));
    // Capturing the pre-change merged baseline only when a change listener actually exists keeps getPath-only scopes
    // from ever materializing the full merge.
    forwarder?.seedBaseline();

    return untrack;
  };

  state = (typeof initializer === 'function' ? initializer(setState, getState) : initializer) as TState;

  // `reconnect` re-attaches after the destroy → remount cycle React StrictMode simulates: it just re-evaluates
  // interest, since the remounted consumers re-subscribe and drive attachment.
  const reconnect = () => {
    destroyed = false;
    syncAttachment();
  };

  const destroy = () => {
    destroyed = true;
    detach();
    listeners.clear();
    pathListeners.clear();
    changeListeners.clear();
    invalidateListeners.clear();
  };

  const api: StoreApi<TState> = {
    getState,
    getPath,
    setState,
    batch,
    subscribe,
    subscribePath,
    subscribeChange,
    destroy,
    reconnect,
    subscribeInvalidate: listener => invalidateListeners.add(listener)
  };

  // Middlewares (logger, persist, history, custom) all ride the one `subscribeChange` substrate. Their setup runs
  // once here, after the store exists, so a middleware body can hydrate via `api.setState`.
  if (storeOptions?.middlewares) {
    for (const middleware of storeOptions.middlewares) {
      const handlers = middleware(api);
      // A middleware's `beforeChange` rides the same interceptor array `setState` consults before each commit, in
      // middleware order — each one sees the previous one's result (transform), or `CANCEL` to block the write.
      if (handlers?.beforeChange) {
        interceptors.push(handlers.beforeChange);
      }

      if (handlers?.onChange) {
        subscribeChange(handlers.onChange);
      }

      if (handlers?.onError) {
        errorHandlers.push(handlers.onError);
      }
    }
  }

  // Dev-only sibling-collision detection: expose this scope's claims registry so its children can report the unowned
  // paths they delegate up, flagging two siblings that clobber the same parent path. Stripped in production.
  if (import.meta.env.MODE !== 'production') {
    (api as WithScopeClaims).scopeClaims = createScopeClaims();
  }

  if (import.meta.env.MODE === 'test') {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
    (api as StoreApiInternal<TState>).changeListeners = changeListeners;
    (api as StoreApiInternal<TState>).interceptors = interceptors;
    (api as StoreApiInternal<TState>).errorHandlers = errorHandlers;
    (api as StoreApiInternal<TState>).getMergeCount = getMergeCount;
  }

  return api;
}

export const createStoreHook = <TState extends object>() => {
  function useStore(options?: UseStoreOptions<TState, TState>): [TState, StoreApi<TState>['setState']];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [
    PathValue<TState, P> | undefined,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>>(
    path: P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue?: never; transformer?: never }
  ): [
    PathValue<TState, P>,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, D>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D; transformer?: never }
  ): [
    NonNullable<PathValue<TState, P>> | D,
    (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void
  ];

  function useStore<P extends PathOf<TState>, TResult>(
    path: P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, (value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)) => void];

  function useStore<P extends PathOf<TState>>(
    pathFn: (state: TState) => P,
    options: Omit<UseStoreOptions<PathValue<TState, P>, TState>, 'defaultValue'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [PathValue<TState, P> | undefined, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>>(
    pathFn: (state: TState) => P,
    options?: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue?: never; transformer?: never }
  ): [PathValue<TState, P>, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>, D>(
    pathFn: (state: TState) => P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { defaultValue: D; transformer?: never }
  ): [NonNullable<PathValue<TState, P>> | D, PathSetter<TState, P>];

  function useStore<P extends PathOf<TState>, TResult>(
    pathFn: (state: TState) => P,
    options: UseStoreOptions<PathValue<TState, P>, TState> & { transformer: (value: PathValue<TState, P>) => TResult }
  ): [TResult, PathSetter<TState, P>];

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options?: Omit<UseStoreMultiOptions<TState, Paths>, 'defaultValue' | 'transformer'>
  ): MultiPathReturn<TState, Paths>;

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>>(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths> & { defaultValue: undefined; transformer?: never }
  ): MultiPathReturn<TState, Paths, undefined>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    const TDefaultValue extends readonly (PathValue<TState, Paths[number]> | undefined)[]
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore<
    const Paths extends ReadonlyArray<PathOf<TState>>,
    TDefaultValue extends PathValue<TState, Paths[number]>
  >(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths, TDefaultValue> & { defaultValue: TDefaultValue; transformer?: never }
  ): MultiPathReturn<TState, Paths, TDefaultValue>;

  function useStore<const Paths extends ReadonlyArray<PathOf<TState>>, TResult>(
    paths: Paths,
    options: UseStoreMultiOptions<TState, Paths> & { transformer: (values: PathValues<TState, Paths>) => TResult }
  ): [TResult, ...PathSetters<TState, Paths>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>>(
    paths: Entries,
    options?: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & { transformer?: never }
  ): [PathOrFnValues<TState, Entries>, ...PathOrFnSetters<TState, Entries>];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>>(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
      defaultValue: undefined;
      transformer?: never;
    }
  ): [{ [I in keyof Entries]: PathOrFnValue<TState, Entries[I]> | undefined }, ...PathOrFnSetters<TState, Entries>];

  function useStore<
    const Entries extends ReadonlyArray<PathOrFn<TState>>,
    const TDefaultValue extends readonly unknown[]
  >(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
      defaultValue: TDefaultValue;
      transformer?: never;
    }
  ): [
    {
      [I in keyof Entries]: I extends keyof TDefaultValue
        ? TDefaultValue[I] extends undefined
          ? PathOrFnValue<TState, Entries[I]> | undefined
          : NonNullable<PathOrFnValue<TState, Entries[I]>> | TDefaultValue[I]
        : PathOrFnValue<TState, Entries[I]>;
    },
    ...PathOrFnSetters<TState, Entries>
  ];

  function useStore<const Entries extends ReadonlyArray<PathOrFn<TState>>, TResult>(
    paths: Entries,
    options: Omit<UseStoreMultiOptions<TState, any>, 'defaultValue' | 'transformer'> & {
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

  function useStoreGetter<P extends PathOf<TState>, D>(
    basePath: P,
    options: UseStoreGetterOptions<TState, D> & { defaultValue: D }
  ): GetValueFromBaseWithDefaultFn<PathValue<TState, P>, D>;

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

export default createStore;
