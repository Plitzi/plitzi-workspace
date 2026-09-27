/**
 * Where a space's functions answer HTTP: `GET /feed/:id` declared, `GET /api/feed/42` served. The path is
 * the functions' and never a page's — the page server and the page linter both read it from here.
 */
export const FUNCTION_ROUTES_PREFIX = '/api';

/** Whether a page at `path` would sit where the space's functions answer. */
export const isFunctionRoutePath = (path: string): boolean =>
  path === FUNCTION_ROUTES_PREFIX || path.startsWith(`${FUNCTION_ROUTES_PREFIX}/`);
