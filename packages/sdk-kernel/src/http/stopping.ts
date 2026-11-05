import type { ServerBaseConfig } from '../types';

/**
 * Whether a server has been told to stop, kept per configuration — what its `/health` reads to answer 503 while it
 * finishes what it was doing, so a load balancer stops sending it work before it stops listening (`server.close()`).
 */

const stopping = new WeakSet<object>();

export const markStopping = (config: object): void => {
  stopping.add(config);
};

export const isStopping = (config: object): boolean => stopping.has(config);

/** How long a server that is closing keeps answering, and how long what it answers may take — see `shutdown`. */
export const SHUTDOWN_ANNOUNCE_MS = 0;

export const shutdownOf = (
  config: Pick<ServerBaseConfig, 'shutdown'>,
  defaults: { graceMs: number }
): { announceMs: number; graceMs: number } => ({
  announceMs: Math.max(0, config.shutdown?.announceMs ?? SHUTDOWN_ANNOUNCE_MS),
  graceMs: Math.max(0, config.shutdown?.graceMs ?? defaults.graceMs)
});
