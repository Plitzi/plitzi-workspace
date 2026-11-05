/**
 * The rendered pages several replicas share, and how any process says they are stale: the store they keep in common
 * (`createRedisPageStore`) and the invalidation that travels on the realtime bus (`createCacheInvalidator`). Apart from
 * the renderer, so a process that writes and serves no pages (a worker, an API) invalidates them without loading it.
 */
export { createRedisPageStore } from './modules/ssr/redisPageStore';
export { createCacheInvalidator, DEFAULT_IGNORED_QUERY_PARAMS } from './helpers/cache';
