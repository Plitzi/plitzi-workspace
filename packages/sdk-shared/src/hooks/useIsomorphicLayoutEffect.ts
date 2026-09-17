/**
 * `useLayoutEffect` in a browser, `useEffect` on a server — where React runs neither, and the layout one warns.
 *
 * Re-exported here rather than imported from nexus at every call site: a package that never takes the store itself
 * (`@plitzi/sdk-auth`) still has effects that must run before its children's.
 */
export { useIsomorphicLayoutEffect as default } from '@plitzi/nexus/react';
