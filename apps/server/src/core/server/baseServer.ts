import { buildTransport, protoLabel } from '../transports';

import type { Handler } from '../transports';
import type { CacheManager, PluginRegistry, SSRServer, SSRServerConfig } from '@plitzi/sdk-shared';

/**
 * What went wrong taking the port, and what to do about it.
 *
 * A server that cannot bind used to surface as an unhandled `error` event: a stack trace through `node:net` naming
 * neither the port nor the server, printed as if the process had crashed at random. It is the first thing a new
 * deployment hits — two roles configured on one port, or a previous run still holding it — so it is worth saying
 * plainly.
 */
const bindFailure = (error: NodeJS.ErrnoException, port: number, label: string): string => {
  if (error.code === 'EADDRINUSE') {
    return (
      `[${label}] cannot bind port ${port}: already in use. Another server is running, or the previous one has ` +
      `not released it yet — find it with \`lsof -iTCP:${port} -sTCP:LISTEN\`, or start this one on another port.`
    );
  }

  if (error.code === 'EACCES') {
    return (
      `[${label}] cannot bind port ${port}: permission denied. Ports below 1024 need privileges — run elevated, ` +
      'or use a port above 1024 and put a proxy in front.'
    );
  }

  if (error.code === 'EADDRNOTAVAIL') {
    return `[${label}] cannot bind port ${port}: the requested host is not an address of this machine.`;
  }

  return `[${label}] failed to bind port ${port}: ${error.message}`;
};

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
  // Defaults to what the transport can actually serve: HTTP/2 when there are certificates, HTTP/1.1 when there are
  // not. No browser speaks cleartext h2, so defaulting to 2 unconditionally meant every local run had to say so —
  // and the ones that forgot got a server that started fine and answered nothing.
  const version = config.httpVersion ?? (config.tls ? 2 : 1);
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

      primary.on('error', (error: NodeJS.ErrnoException) => {
        if (config.onListenError) {
          config.onListenError(error, { port, host, label });

          return;
        }

        console.error(bindFailure(error, port, label));
        // Set as well as exit: the code is what a supervisor reads, and it is already right if something the
        // deployment installed swallows the exit.
        process.exitCode = 1;
        process.exit(1);
      });

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
