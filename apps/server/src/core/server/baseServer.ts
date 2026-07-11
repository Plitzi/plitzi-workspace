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

  let primary: ReturnType<typeof buildTransport>['primary'];
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
    async close() {
      parts.onDestroy?.();
      const closeOne = (srv: typeof primary) =>
        new Promise<void>((resolve, reject) => {
          srv.close(err => (err ? reject(err) : resolve()));
        });

      await Promise.all([closeOne(primary), ...(h3 ? [closeOne(h3)] : [])]);
    }
  };
};
