import { FunctionFailure, functionSizeOfMemory, largerFunctionSize } from '@plitzi/sdk-shared/functions';

import type { FunctionLimits, FunctionStopReason } from '@plitzi/sdk-shared/functions';

/** Why an invocation was stopped: a limit of its own, an abort — or `shed`, given back by a runner short of memory. */
export type StopReason = FunctionStopReason | 'shed';

/** Why a runner gave an invocation back that was within its own memory: the runner's, never the code's. */
export const SHED_SAID =
  'The functions runner ran short of memory and gave this invocation back before it took the whole runner down: ' +
  'another runner takes it';

/**
 * What isolated-vm throws when a `timeout` it was given runs out. Its timeout is wall time while the isolate runs, not
 * CPU: a runner whose isolates share its CPU stretched a 5 ms route past a 100 ms "CPU limit" under load. So it is given
 * the wall limit, a backstop; the CPU limit is the watchdog's, which reads the isolate's share of the process's CPU
 * (`createCpuMeter`).
 */
export const ISOLATE_TIMEOUT = 'Script execution timed out.';

/** Past its memory: how much, and the size to ask for instead — the one thing its author can change. */
const memoryStopMessage = (memoryMb: number): string => {
  const size = functionSizeOfMemory(memoryMb);
  const larger = size ? largerFunctionSize(size) : undefined;
  const ran = size ? ` (a ${size} task)` : '';

  return larger
    ? `Went over its ${String(memoryMb)} MB of memory${ran}: a task that needs more asks to be larger in its limits ({ size: '${larger}' }), as far as its plan allows`
    : `Went over its ${String(memoryMb)} MB of memory${ran}, the most a task runs with: hold less of it at once`;
};

export const stopMessage = (reason: FunctionStopReason, limits: FunctionLimits): string => {
  switch (reason) {
    case 'cpu':
      return `Stopped after ${String(limits.cpuMs)} ms of CPU`;
    case 'wall':
      return `Did not finish within ${String(limits.wallMs)} ms`;
    case 'memory':
      return memoryStopMessage(limits.memoryMb);
    case 'output':
      return `Answered more than the ${String(limits.outputBytes)} bytes it may`;
    case 'calls':
      return `Made more than the ${String(limits.calls)} calls to the platform it may`;
    case 'aborted':
      return 'The run was aborted';
  }
};

/** How a stop reads to the platform: a limit of its own as itself; given back by the runner, as `busy`. */
export const failureOfStop = (reason: StopReason, limits: FunctionLimits): FunctionFailure =>
  reason === 'shed' ? new FunctionFailure('busy', SHED_SAID) : new FunctionFailure(reason, stopMessage(reason, limits));

/**
 * What an invocation that threw failed with. A failure of its own, with nothing stopped, as itself; else the reason it
 * was stopped for — isolated-vm's own timeout is only ever given `wallMs`, so its error is the time limit, a synchronous
 * stretch that outlasted it; an isolate disposed with no reason of ours is V8 out of the isolate's memory, which took it
 * down itself — and the code's own error when there was none.
 */
export const failureOfThrown = (
  error: unknown,
  { stopped, disposed, limits }: { stopped: StopReason | undefined; disposed: boolean; limits: FunctionLimits }
): FunctionFailure => {
  if (error instanceof FunctionFailure && !stopped) {
    return error;
  }

  const timedOut = error instanceof Error && error.message === ISOLATE_TIMEOUT;
  const reason = stopped ?? (timedOut ? 'wall' : disposed ? 'memory' : undefined);

  return reason
    ? failureOfStop(reason, limits)
    : new FunctionFailure('error', error instanceof Error ? error.message : String(error));
};

/** The first reason an invocation is stopped for, kept: what stops it after that changes nothing it says. */
export const createStops = (dispose: () => void) => {
  let stopped: StopReason | undefined;

  return {
    stop: (reason: StopReason): void => {
      stopped ??= reason;
      dispose();
    },
    stopped: (): StopReason | undefined => stopped
  };
};
