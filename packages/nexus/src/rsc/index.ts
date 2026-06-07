// @plitzi/nexus/rsc
// Helpers for React Server Component → Client Component data handoff.

const SSR_FLAG = Symbol('@plitzi/nexus/ssr-snapshot');

type WithSsrFlag<T> = T & { readonly [SSR_FLAG]: true };

/**
 * Wraps server-fetched data so Nexus knows it came from SSR.
 *
 * Usage in a Server Component (App Router):
 *
 * ```tsx
 * import { createServerSnapshot } from '@plitzi/nexus/rsc';
 * import { StoreProvider } from '@plitzi/nexus';
 *
 * export default async function Page() {
 *   const data = await fetch('https://api.example.com/user');
 *   return (
 *     <StoreProvider value={createServerSnapshot(data)}>
 *       <ClientComponent />
 *     </StoreProvider>
 *   );
 * }
 * ```
 */
export function createServerSnapshot<T extends object>(data: T): WithSsrFlag<T> {
  if (SSR_FLAG in (data as object)) {
    return data as unknown as WithSsrFlag<T>;
  }

  return Object.defineProperty(data, SSR_FLAG, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false
  }) as unknown as WithSsrFlag<T>;
}

/** @internal */
export function isServerSnapshot<T>(value: T): value is WithSsrFlag<T> {
  return typeof value === 'object' && value !== null && SSR_FLAG in value;
}

/** @internal Strip the SSR flag from a snapshot (returns a plain object). */
export function stripServerFlag<T extends object>(value: T): T {
  if (!isServerSnapshot(value)) {
    return value;
  }

  // SSR_FLAG is non-enumerable — it won't survive a spread. At runtime this is a no-op
  // but the new object satisfies TypeScript that the flag type is no longer present.
  return { ...value };
}
