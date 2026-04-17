/**
 * @plitzi/server-ssr
 *
 * A standalone HTTP/2-compatible SSR server for Plitzi spaces.
 *
 * ## Usage as a library
 *
 * ```ts
 * import { createSSRServer } from '@plitzi/server-ssr';
 *
 * const server = createSSRServer({
 *   port: 3001,
 *   adapters: {
 *     getOfflineData,
 *     getSpaceDeployment
 *   }
 * });
 *
 * server.listen(3001);
 * ```
 */

export { createSSRServer } from './core/createServer';

export type {
  SSRAdapters,
  SSRServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRMiddleware,
  SSRMiddlewareNext,
  SSRContext,
  SSRSpaceDeployment,
  SSRCredential,
  SSRHeaders
} from './types';
