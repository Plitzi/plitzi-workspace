import { DEFAULT_FUNCTION_ASKED_LIMITS } from '@plitzi/sdk-shared/actions';
import { FUNCTION_SIZES, functionSizesWithin } from '@plitzi/sdk-shared/functions';

import type { FunctionJobLimits } from './jobs';
import type { FunctionAskedLimits } from '@plitzi/sdk-shared';
import type { FunctionsDefinition } from '@plitzi/sdk-shared/functions';
import type { FunctionLimits, FunctionRunner, FunctionUsage } from '@plitzi/sdk-shared/functions';

/**
 * One invocation of a space's task, as metering sees it: what it spent, and the memory it ran with (its size) — what a
 * deployment bills by, as memory over the time it was held.
 */
export type FunctionUsageRecord = {
  spaceId: number;
  task: string;
  ok: boolean;
  usage: FunctionUsage;
  memoryMb: number;
};

/**
 * A server's functions. `native` is code the deployment trusts, loaded in its own process with the context narrowed to
 * a function's; the spaces' own code — which nobody here reviewed — only ever runs in the sandbox (`runner`).
 */
export type FunctionsConfig = {
  native?: FunctionsDefinition[];
  /**
   * Say when an invocation of `native` spends more than a sandbox would let it — calls to `ctx`, CPU, time, the bytes it
   * answers — naming the limit, once per task: a project's own server, whose functions are a hosted space's, runs them
   * natively and held to nothing, and what passed there would fail hosted. Measured, never enforced.
   */
  measureNative?: boolean;
  /**
   * The server halves of the plugins this server ships, by plugin type — loaded natively like `native`, but each with a
   * plugin's narrower `ctx` (its own `kv` and limits, signatures only it verifies, none of the space's credentials or
   * channels). Their tasks are `<type>.<action>`, their routes answer under `/fn/plugins/<type>/`.
   */
  plugins?: Record<string, FunctionsDefinition>;
  /**
   * Where the spaces' own functions run: `createRemoteRunner` for the runner service, a provider's adapter, or
   * `createIsolateRunner` only where this process holds nothing a space must not reach. Absent, spaces have no
   * functions here — their tasks are not offered and none of their code runs.
   */
  runner?: FunctionRunner;
  /**
   * The most one invocation may spend on this deployment ({@link DEFAULT_FUNCTION_CEILINGS} for each unset): what a
   * task may ask for in CPU, time and memory, and what every invocation gets of the rest. A space's plan may allow less, never
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
  /** The spaces' jobs (`defineFunctions({ jobs })`): what each may spend. */
  jobs?: {
    /**
     * What one space's jobs may spend — its plan's — each unset one `DEFAULT_FUNCTION_JOB_LIMITS`'. `pool` names the
     * spaces whose running jobs count together: an account's.
     */
    limitsFor?: (spaceId: number) => Promise<Partial<FunctionJobLimits> | undefined>;
  };
  /** The spaces' OAuth connections (`ctx.oauth`). */
  oauth?: {
    /**
     * The origin every provider sends a visitor back to (`<origin>/fn/oauth/callback`), whichever address they opened
     * the space on — the one address to register, which a server reached on several (`localhost`, its loopback, its
     * address on the network) needs. The visitor is then sent on to the address they started from. Only for a server
     * of one space, such as a project's (`serveProject` sets its `publicUrl`): one of many spaces tells them apart by
     * host, and answers each callback on the space's own. Left out, the address the visitor started on.
     */
    callbackOrigin?: string;
  };
};

/** What an invocation gets unless its task asks for more CPU, time or a larger size. */
export const DEFAULT_FUNCTION_LIMITS: FunctionLimits = {
  cpuMs: DEFAULT_FUNCTION_ASKED_LIMITS.cpuMs,
  wallMs: DEFAULT_FUNCTION_ASKED_LIMITS.wallMs,
  memoryMb: FUNCTION_SIZES[DEFAULT_FUNCTION_ASKED_LIMITS.size].memoryMb,
  outputBytes: 1_000_000,
  calls: 100
};

/**
 * The most a deployment lets one invocation have, unless it says otherwise: two seconds of CPU and half a minute of
 * time, and the largest size, for a task that asks; the rest as every invocation gets it.
 */
export const DEFAULT_FUNCTION_CEILINGS: FunctionLimits = {
  ...DEFAULT_FUNCTION_LIMITS,
  cpuMs: 2_000,
  wallMs: 30_000,
  memoryMb: FUNCTION_SIZES.large.memoryMb
};

/** A deployment's ceilings, each unset one the default's. */
export const functionCeilings = (ceilings: Partial<FunctionLimits> = {}): FunctionLimits => ({
  ...DEFAULT_FUNCTION_CEILINGS,
  ...ceilings
});

/**
 * What one invocation of a space may spend: the CPU, time and size its task asked for — the default's when it asked for
 * none — and the rest as the deployment gives it; never above the space's plan, nor above the deployment's ceilings.
 * A plan's memory is the largest size a task may ask for, never what every invocation is given: the runner keeps an
 * invocation's memory whole while it runs, so each one given the plan's would leave room for a few at once. A size past
 * it is refused before it runs ({@link functionSizeRefusal}), never quietly made smaller.
 */
export const functionLimitsFor = (
  ceilings: Partial<FunctionLimits> = {},
  space: Partial<FunctionLimits> = {},
  asked: FunctionAskedLimits = {}
): FunctionLimits => {
  const ceiling = functionCeilings(ceilings);
  const capOf = (key: keyof FunctionLimits): number => Math.min(space[key] ?? ceiling[key], ceiling[key]);

  return {
    cpuMs: Math.min(asked.cpuMs ?? DEFAULT_FUNCTION_LIMITS.cpuMs, capOf('cpuMs')),
    wallMs: Math.min(asked.wallMs ?? DEFAULT_FUNCTION_LIMITS.wallMs, capOf('wallMs')),
    memoryMb: Math.min(FUNCTION_SIZES[asked.size ?? DEFAULT_FUNCTION_ASKED_LIMITS.size].memoryMb, capOf('memoryMb')),
    outputBytes: capOf('outputBytes'),
    calls: capOf('calls')
  };
};

/**
 * Why a task may not run at the size it asked for — its space's plan, or this server, allows less memory — or nothing.
 * Said before it runs, naming the size that fits and the plan, so its author can choose either.
 */
export const functionSizeRefusal = (
  ceilings: Partial<FunctionLimits> = {},
  space: Partial<FunctionLimits> = {},
  asked: FunctionAskedLimits = {}
): string | undefined => {
  const size = asked.size ?? DEFAULT_FUNCTION_ASKED_LIMITS.size;
  const server = functionCeilings(ceilings).memoryMb;
  const most = Math.min(space.memoryMb ?? server, server);
  const { memoryMb } = FUNCTION_SIZES[size];
  if (memoryMb <= most) {
    return undefined;
  }

  const fits = functionSizesWithin(most).at(-1);
  const who = most < server ? 'its space’s plan allows' : 'this server allows';
  const instead = fits
    ? `${who} up to ${fits} (${String(FUNCTION_SIZES[fits].memoryMb)} MB)`
    : `${who} none of its sizes`;

  return `This task asks to be ${size} (${String(memoryMb)} MB of memory), and ${instead}: ask for a size that fits in its limits, or for a plan that includes ${size}`;
};

/**
 * What one invocation may spend (`functionLimitsFor`) and, when the size it asked for is past what its plan or this
 * server allows, why it may not run (`functionSizeRefusal`) — the one call every place that invokes makes, so none runs
 * a refused size quietly made smaller.
 */
export const invocationLimitsFor = (
  ceilings: Partial<FunctionLimits> = {},
  space: Partial<FunctionLimits> = {},
  asked: FunctionAskedLimits = {}
): { limits: FunctionLimits; sizeRefusal?: string } => {
  const sizeRefusal = functionSizeRefusal(ceilings, space, asked);

  return { limits: functionLimitsFor(ceilings, space, asked), ...(sizeRefusal ? { sizeRefusal } : {}) };
};
