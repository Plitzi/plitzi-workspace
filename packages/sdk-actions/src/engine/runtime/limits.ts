import type { ResolvedActionLimits } from '../types';
import type { ActionLimits } from '@plitzi/sdk-shared';

export const DEFAULT_LIMITS: ResolvedActionLimits = {
  timeoutMs: 10_000,
  streamTimeoutMs: 120_000,
  maxNodes: 50,
  maxRequests: 20,
  /** Generous for an API answer and nowhere near what it takes to hurt a process holding several runs at once. */
  maxResponseBytes: 5_000_000,
  /**
   * Two answers at the response ceiling. A run holds a parsed answer at ~2.5–4× its size while it parses (docs/en/server-packages.md
   * §8.1), so this keeps one run under ~40 MB; what many runs hold together is the guards' `memoryShare`.
   */
  maxRunBytes: 10_000_000
};

const tightest = (deployment: number, ...others: (number | undefined)[]): number =>
  others.reduce<number>(
    (least, other) => (other === undefined || other <= 0 ? least : Math.min(least, other)),
    deployment
  );

/**
 * Merges a document's limits, and its space's, over the deployment's.
 *
 * Each may only ever TIGHTEN: the deployment is the party paying for the connection, the slot and the outbound
 * traffic. The space's are what its plan sells (`ActionsConfig.limitsFor`) — up to the deployment's, never past them —
 * and an authored document is customer input. Letting either widen would make every ceiling advisory — which is the
 * same as not having one.
 */
export const resolveLimits = (
  deployment: ActionLimits = {},
  document: ActionLimits = {},
  space: ActionLimits = {}
): ResolvedActionLimits => {
  const base: ResolvedActionLimits = {
    timeoutMs: deployment.timeoutMs ?? DEFAULT_LIMITS.timeoutMs,
    streamTimeoutMs: deployment.streamTimeoutMs ?? DEFAULT_LIMITS.streamTimeoutMs,
    maxNodes: deployment.maxNodes ?? DEFAULT_LIMITS.maxNodes,
    maxRequests: deployment.maxRequests ?? DEFAULT_LIMITS.maxRequests,
    maxResponseBytes: deployment.maxResponseBytes ?? DEFAULT_LIMITS.maxResponseBytes,
    maxRunBytes: deployment.maxRunBytes ?? DEFAULT_LIMITS.maxRunBytes
  };

  return {
    timeoutMs: tightest(base.timeoutMs, space.timeoutMs, document.timeoutMs),
    streamTimeoutMs: tightest(base.streamTimeoutMs, space.streamTimeoutMs, document.streamTimeoutMs),
    maxNodes: tightest(base.maxNodes, space.maxNodes, document.maxNodes),
    maxRequests: tightest(base.maxRequests, space.maxRequests, document.maxRequests),
    maxResponseBytes: tightest(base.maxResponseBytes, space.maxResponseBytes, document.maxResponseBytes),
    maxRunBytes: tightest(base.maxRunBytes, space.maxRunBytes, document.maxRunBytes)
  };
};
