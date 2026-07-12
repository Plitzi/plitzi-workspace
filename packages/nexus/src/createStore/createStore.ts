/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import { isDev, isTest } from '../env';
import { createChainReads } from './helpers/createChainReads';
import { createSetState } from './helpers/createSetState';
import { forwardParentChanges } from './helpers/forwardParentChanges';
import PathTrie from './helpers/PathTrie';
import { createScopeClaims } from './helpers/scopeCollisions';
import Subscribers from './helpers/Subscribers';

import type {
  ChangeListener,
  GetState,
  Listener,
  PathOf,
  SetState,
  StoreApi,
  StoreApiInternal,
  StoreErrorHandler,
  StoreErrorReporter,
  StoreMiddleware,
  WriteInterceptor
} from '../types';
import type { ScopeClaims } from './helpers/scopeCollisions';

// Identifies each scope for dev-only sibling-collision detection.
let scopeIdSeq = 0;

// A parent exposes its claims registry to children through this dev-only shape (kept off the public StoreApi).
type WithScopeClaims = { scopeClaims?: ScopeClaims };

export type CreateStoreOptions<TState extends object> = {
  id?: string;
  // Position-derived identity for this scope (see `StoreApi.scopePath`). `StoreProvider` computes it from the
  // ancestor `segment` chain and passes it here; standalone stores may set it directly.
  scopePath?: string;
  parent?: StoreApi<TState>;
  // Top-level keys this scope owns EXCLUSIVELY: when seeded they fully shadow the parent (no deep-merge / fall-through)
  // so a per-instance slice stays isolated from an ancestor that uses the same key. Only meaningful with a `parent`.
  exclusive?: ReadonlyArray<string>;
  middlewares?: StoreMiddleware<TState>[];
  /** When true, hydrate handlers are collected but NOT run during creation.
   *  Call `store.hydrate()` manually (StoreProvider does this in a useEffect).
   *  Defaults to false (backward-compatible: standalone usage hydrates synchronously). */
  deferHydrate?: boolean;
};

function createStore<TState extends object>(
  initializer: Partial<TState> | ((set: SetState<TState>, get: GetState<TState>) => Partial<TState>),
  storeOptions?: CreateStoreOptions<TState>
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
    if (invalidateListeners.length === 0) {
      return;
    }

    invalidateListeners.forEach(cb => cb());
  };
  const interceptors: WriteInterceptor<TState>[] = [];
  const errorHandlers: StoreErrorHandler<TState>[] = [];
  const hydrateHandlers: Array<() => void> = [];
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
    resetCache,
    getMergeCount
  } = createChainReads<TState>(getOwnState, getOwnSnapshot, parent, storeOptions?.exclusive);

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

  // A scoped store starts detached (no subscribers yet). We subscribe to invalidation events immediately
  // to keep the cache correct even when detached, ensuring referential stability for useSyncExternalStore.
  if (parent) {
    resetCache();
    invalidateUnsub = parent.subscribeInvalidate?.(onSilentAncestorChange);
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
      isDev && parent ? path => (parent as WithScopeClaims).scopeClaims?.claimDelegatedWrite(path, scopeId) : undefined
  });

  const hasInterest = (): boolean => listeners.length > 0 || pathListeners.size > 0 || changeListeners.length > 0;

  const attach = (): void => {
    if (forwarder || !parent) {
      return;
    }

    // The parent may have changed while detached, so invalidate cached reads and resume caching on attach.
    invalidateReads();
    resetCache();
    forwarder = forwardParentChanges(
      parent,
      listeners,
      pathListeners,
      changeListeners,
      getState,
      reportError,
      invalidateReads
    );
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
    resetCache();
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

  // `reconnect` re-attaches after the destroy → remount cycle React StrictMode simulates: it re-evaluates
  // interest (remounted consumers re-subscribe and drive attachment) and re-establishes the invalidation
  // subscription that `destroy()` tore down.
  const reconnect = () => {
    destroyed = false;
    if (parent) {
      invalidateUnsub?.();
      invalidateUnsub = parent.subscribeInvalidate?.(onSilentAncestorChange);
    }

    syncAttachment();
  };

  const destroy = () => {
    destroyed = true;
    detach();
    listeners.clear();
    pathListeners.clear();
    changeListeners.clear();
    invalidateListeners.clear();
    invalidateUnsub?.();
  };

  const withBase = (basePath: string): any => {
    const boundSet = (subPath: string | undefined, value: unknown) =>
      setState((subPath === undefined ? basePath : `${basePath}.${subPath}`) as PathOf<TState>, value as any);

    return {
      getState: (defaultValue?: unknown) => {
        const value = getPath(basePath as PathOf<TState>);

        return value === undefined && defaultValue !== undefined ? defaultValue : value;
      },
      getPath: (subPath: string, defaultValue?: unknown) => {
        const value = getPath(`${basePath}.${subPath}` as PathOf<TState>);

        return value === undefined && defaultValue !== undefined ? defaultValue : value;
      },
      setState: boundSet,
      subscribe: (listener: Listener) => subscribePath(basePath as PathOf<TState>, listener),
      subscribePath: (subPath: string, listener: Listener) =>
        subscribePath(`${basePath}.${subPath}` as PathOf<TState>, listener),
      get: (subPath?: string) =>
        getPath((subPath === undefined ? basePath : `${basePath}.${subPath}`) as PathOf<TState>),
      set: boundSet,
      watch: (subPathOrListener: string | Listener, listener?: Listener) =>
        typeof subPathOrListener === 'function'
          ? subscribePath(basePath as PathOf<TState>, subPathOrListener)
          : subscribePath(`${basePath}.${subPathOrListener}` as PathOf<TState>, listener as Listener)
    };
  };

  // The three-verb ergonomic facade. Thin aliases over the methods above — no behavior of their own — so the
  // performance-tuned read/write/subscribe paths stay the single source of truth.
  const get = ((path?: PathOf<TState>) => (path === undefined ? getState() : getPath(path))) as StoreApi<TState>['get'];
  const watch = ((pathOrListener: PathOf<TState> | Listener, listener?: Listener) =>
    typeof pathOrListener === 'function'
      ? subscribe(pathOrListener)
      : subscribePath(pathOrListener, listener as Listener)) as StoreApi<TState>['watch'];

  const api: StoreApi<TState> = {
    id: storeOptions?.id,
    scopePath: storeOptions?.scopePath,
    getState,
    getOwnState: getOwnSnapshot,
    getPath,
    setState,
    get,
    set: setState,
    watch,
    withBase,
    batch,
    subscribe,
    subscribePath,
    subscribeChange,
    destroy,
    reconnect,
    subscribeInvalidate: listener => invalidateListeners.add(listener),
    hydrate: () => {
      for (const hydrate of hydrateHandlers) {
        hydrate();
      }
    }
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

      // Hydrate handlers run inline during the middleware loop for standalone usage
      // (preserving order: persistMiddleware placed first hydrates before logger registers).
      // For StoreProvider usage (deferHydrate: true), they're collected and run after mount.
      const hydrateFn = handlers?.hydrate;
      if (hydrateFn) {
        if (storeOptions.deferHydrate) {
          hydrateHandlers.push(() => hydrateFn(api));
        } else {
          hydrateFn(api);
        }
      }
    }
  }

  // Dev-only sibling-collision detection: expose this scope's claims registry so its children can report the unowned
  // paths they delegate up, flagging two siblings that clobber the same parent path. Stripped in production.
  if (isDev) {
    (api as WithScopeClaims).scopeClaims = createScopeClaims();
  }

  if (isTest) {
    (api as StoreApiInternal<TState>).listeners = listeners;
    (api as StoreApiInternal<TState>).pathListeners = pathListeners;
    (api as StoreApiInternal<TState>).changeListeners = changeListeners;
    (api as StoreApiInternal<TState>).interceptors = interceptors;
    (api as StoreApiInternal<TState>).errorHandlers = errorHandlers;
    (api as StoreApiInternal<TState>).invalidateListeners = invalidateListeners;
    (api as StoreApiInternal<TState>).getMergeCount = getMergeCount;
  }

  return api;
}

export default createStore;
