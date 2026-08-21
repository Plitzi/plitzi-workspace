import type { ResolvedActionLimits } from '../types';
import type { ActionLimits } from '@plitzi/sdk-shared';

export const DEFAULT_LIMITS: ResolvedActionLimits = {
  timeoutMs: 10_000,
  streamTimeoutMs: 120_000,
  maxNodes: 50,
  maxRequests: 20,
  /** Generous for an API answer and nowhere near what it takes to hurt a process holding several runs at once. */
  maxResponseBytes: 5_000_000
};

const tightest = (deployment: number, document: number | undefined): number =>
  document === undefined || document <= 0 ? deployment : Math.min(deployment, document);

/**
 * Merges a document's limits over the deployment's.
 *
 * A per-action value may only ever TIGHTEN: the deployment is the party paying for the connection, the slot and
 * the outbound traffic, and an authored document is customer input. Letting it widen would make every ceiling
 * advisory — which is the same as not having one.
 */
export const resolveLimits = (deployment: ActionLimits = {}, document: ActionLimits = {}): ResolvedActionLimits => {
  const base: ResolvedActionLimits = {
    timeoutMs: deployment.timeoutMs ?? DEFAULT_LIMITS.timeoutMs,
    streamTimeoutMs: deployment.streamTimeoutMs ?? DEFAULT_LIMITS.streamTimeoutMs,
    maxNodes: deployment.maxNodes ?? DEFAULT_LIMITS.maxNodes,
    maxRequests: deployment.maxRequests ?? DEFAULT_LIMITS.maxRequests,
    maxResponseBytes: deployment.maxResponseBytes ?? DEFAULT_LIMITS.maxResponseBytes
  };

  return {
    timeoutMs: tightest(base.timeoutMs, document.timeoutMs),
    streamTimeoutMs: tightest(base.streamTimeoutMs, document.streamTimeoutMs),
    maxNodes: tightest(base.maxNodes, document.maxNodes),
    maxRequests: tightest(base.maxRequests, document.maxRequests),
    maxResponseBytes: tightest(base.maxResponseBytes, document.maxResponseBytes)
  };
};
