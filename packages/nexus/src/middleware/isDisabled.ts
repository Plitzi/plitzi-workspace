import type { MiddlewareOptions } from '../types';

// True when a middleware should skip itself: `enabled` is `false`, or a predicate that resolves false for `state`.
export const isDisabled = <T extends object>(enabled: MiddlewareOptions<T>['enabled'], state: T): boolean =>
  typeof enabled === 'function' ? !enabled(state) : enabled === false;
