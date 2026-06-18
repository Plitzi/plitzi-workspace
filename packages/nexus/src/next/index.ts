// @plitzi/nexus/next
// Helpers for Next.js App Router integration.

import type { PathOf, PathValue, StoreApi } from '../types';

export type ServerActionResult<TState extends object, P extends PathOf<TState>> = (
  value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
) => Promise<void>;

/**
 * Binds a Nexus store path to a Next.js Server Action, giving you
 * optimistic updates + automatic revalidation.
 *
 * ```ts
 * 'use client';
 * import { useStore } from '@plitzi/nexus';
 * import { bindServerAction } from '@plitzi/nexus/next';
 *
 * function Likes({ store, updateLikes }: { store: StoreApi<State>; updateLikes: ServerAction }) {
 *   const [likes, setLikes] = useStore('likes');
 *   const syncLikes = bindServerAction(store, 'likes', updateLikes, { revalidatePath: '/dashboard' });
 *
 *   return <button onClick={() => syncLikes(n => n + 1)}>{likes}</button>;
 * }
 * ```
 *
 * ⚠️ This file imports from `next/cache` dynamically. It only works within
 * Next.js App Router — not a peer dependency, just a compatibility layer.
 */
export function bindServerAction<TState extends object, P extends PathOf<TState>>(
  store: StoreApi<TState>,
  path: P,
  action: (value: PathValue<TState, P>) => Promise<PathValue<TState, P>>,
  options?: { revalidatePath?: string; revalidateTag?: string }
): ServerActionResult<TState, P> {
  const revalidate = options?.revalidatePath || options?.revalidateTag;

  return async valueOrFn => {
    const prev = store.getPath(path) as PathValue<TState, P>;
    const next =
      typeof valueOrFn === 'function'
        ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          (valueOrFn as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prev)
        : valueOrFn;

    // Optimistic update
    store.setState(path, next);

    try {
      await action(next);

      // Revalidate so the RSC tree re-renders with fresh data
      if (revalidate) {
        const nextModuleName = 'next/cache';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const nextCache: { revalidatePath: (p: string) => void; revalidateTag: (t: string) => void } = await import(
          nextModuleName
        );

        if (options.revalidatePath) {
          nextCache.revalidatePath(options.revalidatePath);
        }
        if (options.revalidateTag) {
          nextCache.revalidateTag(options.revalidateTag);
        }
      }
    } catch (err) {
      // Rollback
      store.setState(path, prev);
      throw err;
    }
  };
}
