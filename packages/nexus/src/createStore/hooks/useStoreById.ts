import { useResolvedStore } from './shared';

import type { StoreApi } from '../../types';

// Returns the store registered under `id` by an ancestor `<StoreProvider id={...}>` — reachable even across a
// disconnected (`inherit`-less) provider that shadows the nearest store. With no `id`, returns the nearest provider's
// store. Use it for imperative access (`getState`/`getPath`/`setState`); for reactive reads pass `{ storeId }` to
// `useStore` instead. Throws if nothing resolves.
export function useStoreById<TState extends object = object>(id?: string): StoreApi<TState> {
  return useResolvedStore<TState>(undefined, 'useStoreById', id);
}

export default useStoreById;
