import { SHUTDOWN_GRACE_MS, watchConnections } from './drain';
import { channelName } from './fleet/link';
import { fleetRole, resolveWorkers } from './fleet/role';
import { markStopping, shutdownOf } from './stopping';
import { buildTransport, protoLabel } from './transports';
import { serverLog } from '../log/serverLog';
import { statsConfigProblem } from '../stats/stage';

import type { FleetStores } from './fleet/link';
import type { Fleet } from './fleet/supervisor';
import type { Handler } from './transports';
import type { ServerBaseConfig } from '../types';

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
  /** Started once the transport is bound: background work that should not run in a server nobody listened on. */
  onListen?: () => void;
  /**
   * The server has stopped taking connections and is shutting down: what holds connections open for good — realtime
   * sockets and streams — lets them go now, rather than being cut when the grace runs out.
   */
  onClosing?: () => void;
  /**
   * Told to stop, before it announces it: what takes work of its own accord — a job worker claiming — stops taking it,
   * so what arrives meanwhile goes to the replicas that stay.
   */
  onStopping?: () => void;
  /** Awaited, so a server that holds work in flight — jobs, drains — can finish it before the sockets close. */
  onDestroy?: () => void | Promise<void>;
  /** What the primary does once, before it starts the workers — work each of them would otherwise repeat, or race
   *  the others to do. */
  beforeFork?: () => Promise<void>;
  /** What the primary keeps for its workers to share (`fleet/link.ts`): each store named by the module that keeps it. */
  fleetStores?: FleetStores;
}

/**
 * A server's transport and its lifecycle — what every server built on this shares. What a server offers beyond that
 * (a page server's caches and plugins) it adds itself, over `channel` where it has workers to keep in step.
 */
export interface HttpServer {
  listen: (port: number, host?: string) => Promise<void>;
  close: () => Promise<void>;
  /**
   * The name this server's broadcasts go by among its fleet's processes (`fleet/link.ts`), the same in the primary and
   * each worker; undefined for a single process, which has nobody to tell.
   */
  channel: string | undefined;
}

// The only thing every server shares: an HTTP transport and the listen/close lifecycle. It knows nothing about
// pipelines or render deps — each server hands in its own port-bound handler and the bits to expose/tear down.
export const createHttpServer = (
  config: ServerBaseConfig,
  makeHandlerForPort: (port: number) => Handler,
  parts: HttpServerParts
): HttpServer => {
  const { label } = parts;
  const statsProblem = statsConfigProblem(config);
  if (statsProblem) {
    throw new Error(`[${label}] ${statsProblem}`);
  }

  // Defaults to what the transport can actually serve: HTTP/2 when there are certificates, HTTP/1.1 when there are
  // not. No browser speaks cleartext h2, so defaulting to 2 unconditionally meant every local run had to say so —
  // and the ones that forgot got a server that started fine and answered nothing.
  const version = config.httpVersion ?? (config.tls ? 2 : 1);
  if (version >= 3 && !config.tls) {
    throw new Error(`[${label}] httpVersion: ${version} requires a tls config with key and cert`);
  }

  // Undefined until listen() builds the transport, and `close()` has to cope with that — see below.
  let primary: ReturnType<typeof buildTransport>['primary'] | undefined;
  let connections: ReturnType<typeof watchConnections> | undefined;
  let h3: ReturnType<typeof buildTransport>['h3'];
  // Set on a primary that started workers instead of binding.
  let fleet: Fleet | undefined;
  let closed = false;
  // The fork between one process and several (fleet/role.ts), decided once. A single server is exactly what it was
  // before workers existed; in a fleet, what one process is told about its caches reaches the others.
  const plan = resolveWorkers(config.workers);
  const role = fleetRole(plan);
  const channel = role === 'single' ? undefined : channelName(label);

  return {
    channel,
    listen(port: number, host = '0.0.0.0'): Promise<void> {
      // Said where the count is decided: each worker runs this same config, and would repeat it.
      if (plan.requested !== undefined && role !== 'worker') {
        serverLog.warn(
          label,
          `${plan.requested} workers asked for, ${plan.count} cores to run them on: starting ${plan.count}`
        );
      }

      if (role === 'primary') {
        // The primary serves nothing itself: it prepares what the workers share, starts them, and keeps them running.
        // The supervisor is loaded only here, so a single server never loads it.
        return new Promise<void>(resolve => {
          void (parts.beforeFork?.() ?? Promise.resolve())
            .catch((error: unknown) => serverLog.error(label, 'preparing for the workers failed', error))
            .then(async () => {
              const { startFleet } = await import('./fleet/supervisor');
              // Closed while it prepared: starting workers now would outlive the server that was asked to stop.
              if (closed) {
                return;
              }

              fleet = startFleet(plan.count, label, parts.fleetStores ?? {});
              serverLog.info(label, `${plan.count} workers on ${host}:${port}`);
              await fleet.listening;
              resolve();
            })
            .catch((error: unknown) => {
              serverLog.error(label, 'the workers could not start', error);
              process.exitCode = 1;
            });
        });
      }

      const handler = makeHandlerForPort(port);
      ({ primary, h3 } = buildTransport(config, handler, port, label));
      connections = watchConnections(primary);

      primary.on('error', (error: NodeJS.ErrnoException) => {
        if (config.onListenError) {
          config.onListenError(error, { port, host, label });

          return;
        }

        serverLog.error(label, bindFailure(error, port, label));
        // Set as well as exit: the code is what a supervisor reads, and it is already right if something the
        // deployment installed swallows the exit.
        process.exitCode = 1;
        process.exit(1);
      });

      const bound = primary;

      return new Promise<void>(resolve => {
        bound.listen(port, host, () => {
          serverLog.info(label, `${protoLabel(version, !!config.tls)} - listening on ${host}:${port}`);
          parts.onListen?.();
          resolve();
        });
      });
    },
    // Tears down what the server owns whether or not it ever listened. A built-but-never-started server still
    // holds the caches and plugin manager onDestroy releases, and closing it must not depend on a socket
    // existing — that is what made an unstarted server throw on close instead of simply releasing its resources.
    async close() {
      closed = true;
      const { announceMs, graceMs } = shutdownOf(config, { graceMs: SHUTDOWN_GRACE_MS });
      // Said before it stops listening: `/health` answers 503 from here, and for `announceMs` it serves as before, so
      // a load balancer takes it out of rotation before a request finds the port closed.
      markStopping(config);
      parts.onStopping?.();
      if (announceMs > 0 && primary) {
        serverLog.info(label, `stopping: /health answers 503 for ${String(announceMs)} ms, then what runs finishes`);
        await new Promise(resolve => setTimeout(resolve, announceMs));
      }

      // The workers first: each finishes what it is serving before the primary lets go of what it holds.
      await fleet?.stop();
      fleet = undefined;

      // No new connection from here, and the open ones let go: requests finish, streams end, the rest is cut after the
      // grace (`drain.ts`). Started before the jobs are waited for, so a page reconnecting meanwhile finds nothing.
      const draining = connections?.drain(label, graceMs);
      const quic = h3;
      primary = undefined;
      connections = undefined;
      h3 = undefined;
      parts.onClosing?.();
      await parts.onDestroy?.();

      await Promise.all([
        draining,
        quic &&
          new Promise<void>((resolve, reject) => {
            quic.close(error => {
              if (error && !('code' in error && error.code === 'ERR_SERVER_NOT_RUNNING')) {
                reject(error);

                return;
              }

              resolve();
            });
          })
      ]);
    }
  };
};
