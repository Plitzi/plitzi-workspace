import { DEFAULT_FUNCTION_TIME_LIMITS } from '@plitzi/sdk-shared/actions';

import type { FunctionsDefinition } from './contract';
import type { FunctionLimits, FunctionRunner, FunctionUsage } from './protocol';
import type { FunctionTimeLimits } from '@plitzi/sdk-shared';

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
  /**
   * The most one invocation may spend on this deployment ({@link DEFAULT_FUNCTION_CEILINGS} for each unset): what a
   * task may ask for in CPU and time, and what every invocation gets of the rest. A space's plan may allow less, never
   * more.
   */
  limits?: Partial<FunctionLimits>;
  /**
   * Asked before each invocation: why this space may not run code right now — its account spent its CPU for the minute,
   * say — or nothing. What keeps one space's loop from slowing everybody else's on the same runner.
   */
  admit?: (spaceId: number) => Promise<string | undefined>;
  /** Told what each invocation spent, however it ended: what `admit` budgets by, and what a deployment meters. */
  onUsage?: (record: FunctionUsageRecord) => void;
};

/** What an invocation gets unless its task asks for more CPU or time. */
export const DEFAULT_FUNCTION_LIMITS: FunctionLimits = {
  ...DEFAULT_FUNCTION_TIME_LIMITS,
  memoryMb: 64,
  outputBytes: 1_000_000,
  calls: 100
};

/**
 * The most a deployment lets one invocation have, unless it says otherwise: two seconds of CPU and half a minute of
 * time for a task that asks; the rest as every invocation gets it.
 */
export const DEFAULT_FUNCTION_CEILINGS: FunctionLimits = { ...DEFAULT_FUNCTION_LIMITS, cpuMs: 2_000, wallMs: 30_000 };

/** A deployment's ceilings, each unset one the default's. */
export const functionCeilings = (ceilings: Partial<FunctionLimits> = {}): FunctionLimits => ({
  ...DEFAULT_FUNCTION_CEILINGS,
  ...ceilings
});

/**
 * What one invocation of a space may spend: the CPU and time its task asked for — the default's when it asked for none
 * — and the rest as the deployment gives it; never above the space's plan, nor above the deployment's ceilings.
 */
export const functionLimitsFor = (
  ceilings: Partial<FunctionLimits> = {},
  space: Partial<FunctionLimits> = {},
  asked: FunctionTimeLimits = {}
): FunctionLimits => {
  const ceiling = functionCeilings(ceilings);
  const capOf = (key: keyof FunctionLimits): number => Math.min(space[key] ?? ceiling[key], ceiling[key]);

  return {
    cpuMs: Math.min(asked.cpuMs ?? DEFAULT_FUNCTION_LIMITS.cpuMs, capOf('cpuMs')),
    wallMs: Math.min(asked.wallMs ?? DEFAULT_FUNCTION_LIMITS.wallMs, capOf('wallMs')),
    memoryMb: capOf('memoryMb'),
    outputBytes: capOf('outputBytes'),
    calls: capOf('calls')
  };
};
