/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

import createStore from '../createStore';
import { isDev } from '../env';
import { isServerSnapshot, stripServerFlag } from '../rsc';
import useStoreSync from './hooks/useStoreSync';
import { findStoreInRegistry, StoreContext, StoreRegistryContext } from './StoreContext';

import type { StoreRegistry } from './StoreContext';
import type { StoreApi, StoreMiddleware } from '../types';
import type { ReactNode } from 'react';

// Middlewares marked with `cascade()` flow down to nested providers through this context, so a logger set once at the
// root is inherited by every child store instead of being repeated in each provider.
const StoreMiddlewareContext = createContext<StoreMiddleware<any>[] | undefined>(undefined);

const cascades = (middleware: StoreMiddleware<any>): boolean => (middleware as { cascade?: boolean }).cascade === true;

export type StoreProviderProps<TState extends object = any> = {
  store?: StoreApi<TState>;
  // Names this store so descendants can reach it by id — `useStore(path, { storeId })` — even across a disconnected
  // (`inherit`-less) provider in between. Identity also shows up on the store (`store.id`) for logging/devtools.
  id?: string;
  // Contributes one segment to the position-derived `scopePath` (see `StoreApi.scopePath`): the child path is the
  // parent path joined with this segment by `/`. Omit it for structural/wrapper providers that should not add an
  // addressable instance — they forward the parent path unchanged. Among siblings a `segment` must be unique to keep
  // paths collision-free (for a repeated subtree, fold the row key/index in, e.g. `segment={`${id}#${index}`}`).
  segment?: string;
  // Top-level keys this scope owns EXCLUSIVELY (only with `inherit="live"`): a seeded key here fully shadows the
  // parent — no deep-merge, no fall-through — keeping a per-instance slice (e.g. an element's `state`) isolated from
  // an ancestor scope that uses the same key. Keys not seeded by this provider are still inherited normally.
  isolate?: ReadonlyArray<string>;
  path?: string;
  value?: Partial<TState> | ((state: TState) => TState);
  /**
   * How this scope derives from the parent store:
   * - `'snapshot'`: copy parent keys once at init; isolated thereafter (writes stay local, parent updates do
   *   not propagate). Use for draft/diverge editors.
   * - `'live'`: live scope chain — reads fall through to the parent, own keys shadow inherited ones, and writes
   *   delegate to the owning scope. Parent updates propagate.
   * - `undefined` (default): no inheritance.
   */
  inherit?: 'snapshot' | 'live';
  autoSync?: boolean;
  // Store middlewares applied when this provider creates the store: `loggerMiddleware()`, `persistMiddleware()`,
  // `historyMiddleware()`, or your own. History is only recorded when `historyMiddleware()` is added — `useStoreHistory`
  // then reads it (without it, the hook returns an empty, no-op view).
  middlewares?: StoreMiddleware<TState>[];
  children?: ReactNode;
};

const StoreProvider = <TState extends object = any>({
  store,
  id,
  segment,
  isolate,
  path,
  value,
  inherit,
  autoSync = true,
  middlewares,
  children
}: StoreProviderProps<TState>) => {
  const parentStore = useContext(StoreContext) as StoreApi<TState> | undefined;
  const inheritedMiddlewares = useContext(StoreMiddlewareContext) as StoreMiddleware<TState>[] | undefined;
  const parentRegistry = useContext(StoreRegistryContext);
  // The parent scope path travels on the parent store itself (`store.scopePath`) — no separate context. A
  // `segment`-less provider is transparent: it forwards the parent path so structural wrappers don't pollute the
  // addressable identity. With a `segment`, this scope's path extends the parent's by one `/`-joined step.
  const parentScopePath = parentStore?.scopePath ?? '';
  const scopePath = useMemo(
    () => (segment === undefined ? parentScopePath : parentScopePath ? `${parentScopePath}/${segment}` : segment),
    [parentScopePath, segment]
  );
  const storeRef = useRef<StoreApi<TState>>(undefined);
  const liveChain = inherit === 'live';
  const storeState = useMemo(() => {
    const parentState = inherit === 'snapshot' && parentStore ? parentStore.getState() : ({} as TState);
    const merged = typeof value === 'function' ? value(parentState) : { ...parentState, ...value };

    return isServerSnapshot(merged) ? stripServerFlag(merged) : merged;
  }, [inherit, parentStore, value]);

  // This store gets the cascaded middlewares from ancestor providers plus its own. The set this provider hands to its
  // descendants is the inherited cascade plus its own `cascade()`-marked middlewares — but when this provider adds no
  // cascading middleware of its own, we pass the inherited array through BY REFERENCE so the `StoreMiddlewareContext`
  // provider below can be skipped entirely (it would otherwise re-provide an identical value, an extra fiber per scope).
  const ownMiddlewares = middlewares ?? [];
  const storeMiddlewares = inheritedMiddlewares ? [...inheritedMiddlewares, ...ownMiddlewares] : ownMiddlewares;
  const cascadedMiddlewares = useMemo(() => {
    const ownCascading = ownMiddlewares.filter(cascades);

    return ownCascading.length === 0 ? inheritedMiddlewares : [...(inheritedMiddlewares ?? []), ...ownCascading];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inheritedMiddlewares, middlewares]);

  if (!storeRef.current) {
    storeRef.current =
      store ??
      createStore<TState>(() => storeState, {
        id,
        scopePath,
        exclusive: liveChain ? isolate : undefined,
        parent: liveChain ? parentStore : undefined,
        middlewares: storeMiddlewares.length > 0 ? storeMiddlewares : undefined,
        deferHydrate: true
      });
  }

  // Register this store under `id` in the parallel registry, regardless of `inherit`, so a descendant can reach it
  // by id even past a disconnected provider. A linked-list node (no Map copy) keeps each provider O(1).
  const registry = useMemo<StoreRegistry | undefined>(
    () => (id ? { id, store: storeRef.current as StoreApi<TState>, parent: parentRegistry } : parentRegistry),
    [id, parentRegistry]
  );

  // Dev-only guard: a duplicate `id` that shadows an ancestor with the same id is almost always a mistake — a
  // descendant's `{ storeId }` / `useStoreById` would silently resolve to the nearer one. `warnedDuplicateRef` keeps
  // it to a single warning per instance (StrictMode remounts reuse the same instance). Stripped in production.
  const warnedDuplicateRef = useRef(false);
  useEffect(() => {
    if (isDev && id && !warnedDuplicateRef.current && findStoreInRegistry(parentRegistry, id)) {
      warnedDuplicateRef.current = true;
      console.warn(
        `@plitzi/nexus: duplicate StoreProvider id "${id}" — it shadows an ancestor provider with the same id, ` +
          `so a descendant's { storeId: "${id}" } or useStoreById("${id}") resolves to this (nearer) store. Use a ` +
          'distinct id, or remove one of the providers.'
      );
    }
  }, [id, parentRegistry]);

  useEffect(() => {
    // Re-attach the parent link on (re)mount. StrictMode runs mount → unmount → remount reusing the same store
    // instance, and the cleanup below detaches it on the simulated unmount; without this the live scope would
    // stop receiving parent updates in dev.
    if (liveChain && !store) {
      storeRef.current?.reconnect?.();
    }

    return () => {
      if (liveChain && !store) {
        storeRef.current?.destroy?.();
      }
    };
  }, [liveChain, store]);

  // Hydrate middlewares (e.g., restore persisted state) after mount. This runs after React hydration is complete,
  // so persistMiddleware reading from localStorage can't cause a hydration mismatch.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current && storeRef.current?.hydrate) {
      storeRef.current.hydrate();
      hydratedRef.current = true;
    }
  }, []);

  const syncEnabled = !!value && autoSync;

  // One sync call covers both shapes: a `path` syncs that key, an absent `path` syncs the whole seeded state.
  useStoreSync(path as any, (path ? value : storeState) as any, {
    enabled: syncEnabled,
    store: storeRef.current
  });

  // Only wrap in a context provider when this scope actually changes that context's value. A scope with no `id`
  // re-provides the parent registry, and a scope with no own cascading middleware re-provides the inherited set —
  // skipping those redundant providers removes two fibers per scope (the common per-element case keeps just one).
  let tree = <StoreContext value={storeRef.current}>{children}</StoreContext>;
  if (registry !== parentRegistry) {
    tree = <StoreRegistryContext value={registry}>{tree}</StoreRegistryContext>;
  }

  if (cascadedMiddlewares !== inheritedMiddlewares) {
    tree = <StoreMiddlewareContext value={cascadedMiddlewares}>{tree}</StoreMiddlewareContext>;
  }

  return tree;
};

export { StoreContext, StoreRegistryContext };

export default StoreProvider;
