import type { FunctionsDefinition } from './contract';
import type { FunctionLimits, FunctionRunner, FunctionUsage } from './protocol';

/** One invocation of a space's task, as metering sees it. */
export type FunctionUsageRecord = { spaceId: number; task: string; ok: boolean; usage: FunctionUsage };

/**
 * A server's functions. `native` is code the deployment trusts, loaded in its own process with the context narrowed to
 * a function's; the spaces' own code — which nobody here reviewed — only ever runs in the sandbox (`runner`).
 */
export type FunctionsConfig = {
  native?: FunctionsDefinition[];
  /**
   * Where the spaces' own functions run: `createRemoteRunner` for the runner service, a provider's adapter, or
   * `createIsolateRunner` only where this process holds nothing a space must not reach. Absent, spaces have no
   * functions here — their tasks are not offered and none of their code runs.
   */
  runner?: FunctionRunner;
  /** The most one invocation may spend on this deployment. A space's plan may ask for less, never more. */
  limits?: Partial<FunctionLimits>;
  /**
   * Asked before each invocation: why this space may not run code right now — its account spent its CPU for the minute,
   * say — or nothing. What keeps one space's loop from slowing everybody else's on the same runner.
   */
  admit?: (spaceId: number) => Promise<string | undefined>;
  /** Told what each invocation spent, however it ended: what `admit` budgets by, and what a deployment meters. */
  onUsage?: (record: FunctionUsageRecord) => void;
};

export const DEFAULT_FUNCTION_LIMITS: FunctionLimits = {
  cpuMs: 100,
  wallMs: 10_000,
  memoryMb: 64,
  outputBytes: 1_000_000,
  calls: 100
};

/** What one invocation of a space may spend: its own limits, never above the deployment's. */
export const functionLimitsFor = (
  ceilings: Partial<FunctionLimits> = {},
  space: Partial<FunctionLimits> = {}
): FunctionLimits => {
  const ceiling = { ...DEFAULT_FUNCTION_LIMITS, ...ceilings };

  return {
    cpuMs: Math.min(space.cpuMs ?? ceiling.cpuMs, ceiling.cpuMs),
    wallMs: Math.min(space.wallMs ?? ceiling.wallMs, ceiling.wallMs),
    memoryMb: Math.min(space.memoryMb ?? ceiling.memoryMb, ceiling.memoryMb),
    outputBytes: Math.min(space.outputBytes ?? ceiling.outputBytes, ceiling.outputBytes),
    calls: Math.min(space.calls ?? ceiling.calls, ceiling.calls)
  };
};
