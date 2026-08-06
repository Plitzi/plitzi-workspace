import { buildTransport, protoLabel } from '../transports';

import type { Handler } from '../transports';
import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

export interface HttpServerParts {
  // Names the server in logs and errors (e.g. SSR, MCP) — this module is service-agnostic.
  label: string;
  cache: CacheManager | null;
  plugins: PluginRegistry;
  onDestroy?: () => void;
}

// The only thing every server shares: an HTTP transport and the listen/close lifecycle. It knows nothing about
// pipelines or render deps — each server hands in its own port-bound handler and the bits to expose/tear down.
export const createHttpServer = (
  config: SSRServerConfig,
  makeHandlerForPort: (port: number) => Handler,
  parts: HttpServerParts
): SSRServer => {
  const { label } = parts;
  const version = config.httpVersion ?? 2;
  if (version >= 3 && !config.tls) {
    throw new Error(`[${label}] httpVersion: ${version} requires a tls config with key and cert`);
  }

  // Undefined until listen() builds the transport, and `close()` has to cope with that — see below.
  let primary: ReturnType<typeof buildTransport>['primary'] | undefined;
  let h3: ReturnType<typeof buildTransport>['h3'];

  return {
    cache: parts.cache,
    plugins: parts.plugins,
    listen(port: number, host = '0.0.0.0') {
      const handler = makeHandlerForPort(port);
      ({ primary, h3 } = buildTransport(config, handler, port, label));
      primary.listen(port, host, () => {
        console.log(`[${label}] ${protoLabel(version, !!config.tls)} - listening on ${host}:${port}`);
      });
    },
    // Tears down what the server owns whether or not it ever listened. A built-but-never-started server still
    // holds the caches and plugin manager onDestroy releases, and closing it must not depend on a socket
    // existing — that is what made an unstarted server throw on close instead of simply releasing its resources.
    async close() {
      parts.onDestroy?.();

      const open = [primary, h3].filter(srv => srv !== undefined);
      primary = undefined;
      h3 = undefined;

      await Promise.all(
        open.map(
          srv =>
            new Promise<void>((resolve, reject) => {
              srv.close(err => {
                // ERR_SERVER_NOT_RUNNING is the state close() is trying to reach, so it is not a failure: it
                // shows up when the bind has not completed yet (a shutdown signal during startup) or when the
                // transport was already closed. Anything else is a real teardown error.
                if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
                  reject(err);

                  return;
                }

                resolve();
              });
            })
        )
      );
    }
  };
};
