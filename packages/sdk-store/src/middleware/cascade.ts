import type { StoreMiddleware } from '../types';

// Marks a middleware so nested `StoreProvider`s inherit it — set a logger (or analytics) once at the root instead of
// repeating it in every child provider. Each inheriting store still gets its own middleware instance. Storage- or
// recorder-bound middlewares (`persist`, `history`) are deliberately NOT cascaded: they're per-store by nature
// (one storage key, one recorder), so mark them yourself only if you really mean it.
export const cascade = <T extends object>(middleware: StoreMiddleware<T>): StoreMiddleware<T> =>
  Object.assign(middleware, { cascade: true as const });
