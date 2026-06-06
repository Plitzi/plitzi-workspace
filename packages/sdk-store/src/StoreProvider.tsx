/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

import createStore from './createStore';
import useStoreSync from './createStore/hooks/useStoreSync';
import { findStoreInRegistry, StoreContext, StoreRegistryContext } from './StoreContext';

import type { StoreRegistry } from './StoreContext';
import type { StoreApi, StoreMiddleware } from './types';
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
  const storeRef = useRef<StoreApi<TState>>(undefined);
  const liveChain = inherit === 'live';
  const storeState = useMemo(() => {
    const parentState = inherit === 'snapshot' && parentStore ? parentStore.getState() : ({} as TState);

    return typeof value === 'function' ? value(parentState) : { ...parentState, ...value };
  }, [inherit, parentStore, value]);

  // This store gets the cascaded middlewares from ancestor providers plus its own. The set this provider hands to its
  // descendants is the inherited cascade plus its own `cascade()`-marked middlewares.
  const ownMiddlewares = middlewares ?? [];
  const storeMiddlewares = inheritedMiddlewares ? [...inheritedMiddlewares, ...ownMiddlewares] : ownMiddlewares;
  const cascadedMiddlewares = useMemo(
    () => [...(inheritedMiddlewares ?? []), ...ownMiddlewares.filter(cascades)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inheritedMiddlewares, middlewares]
  );

  if (!storeRef.current) {
    storeRef.current =
      store ??
      createStore<TState>(() => storeState, {
        id,
        parent: liveChain ? parentStore : undefined,
        middlewares: storeMiddlewares.length > 0 ? storeMiddlewares : undefined
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
    if (
      import.meta.env.MODE !== 'production' &&
      id &&
      !warnedDuplicateRef.current &&
      findStoreInRegistry(parentRegistry, id)
    ) {
      warnedDuplicateRef.current = true;
      console.warn(
        `@plitzi/sdk-store: duplicate StoreProvider id "${id}" — it shadows an ancestor provider with the same id, ` +
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

  const syncEnabled = !!value && autoSync;

  useStoreSync(path as any, (path ? value : storeState) as any, {
    enabled: syncEnabled && !!path,
    store: storeRef.current
  });
  useStoreSync<TState>(undefined, storeState as Partial<TState>, {
    enabled: syncEnabled && !path,
    store: storeRef.current
  });

  return (
    <StoreMiddlewareContext value={cascadedMiddlewares.length > 0 ? cascadedMiddlewares : undefined}>
      <StoreRegistryContext value={registry}>
        <StoreContext value={storeRef.current}>{children}</StoreContext>
      </StoreRegistryContext>
    </StoreMiddlewareContext>
  );
};

export { StoreContext, StoreRegistryContext };

export default StoreProvider;
