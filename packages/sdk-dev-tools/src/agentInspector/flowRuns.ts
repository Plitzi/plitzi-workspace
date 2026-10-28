import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { InteractionFlowParams, InteractionNode, Log } from '@plitzi/sdk-shared';

/** One step of a flow that ran, in words — `refused` when it ran and the run it started was refused (`error`, why). */
export type FlowStep = { title: string; action: string; status: string; ms: number; error?: string };

/** A flow that ran: what fired it, on what, how it ended, and every step it took. */
export type FlowRun = {
  at: string;
  trigger: string;
  on?: string;
  status: string;
  ms: number;
  steps: FlowStep[];
};

const isFlowParams = (params: Log['params']): params is InteractionFlowParams =>
  typeof params === 'object' && 'nodes' in params && 'startTime' in params && 'node' in params;

/**
 * A step that ran and answered that the run it started did not complete — a server action the server refused. The
 * step itself succeeded, its flow going on to a `whenFailed` notice, so its status alone read "success": a run's scout
 * was told a refused room had been made. Its words, and the server's reason for it.
 */
const refusalOf = (step: InteractionNode): string | undefined => {
  if (step.status !== 'success' || !isRecord(step.result)) {
    return undefined;
  }

  const { status, reason, error } = step.result;
  if (status !== 'failed' && status !== 'aborted') {
    return undefined;
  }

  const why = typeof reason === 'string' && reason !== '' ? reason : status;

  return typeof error === 'string' && error !== '' ? `${error} (${why})` : why;
};

const errorOf = (step: InteractionNode): string | undefined => {
  if (step.status !== 'failed') {
    return undefined;
  }

  if (step.result instanceof Error) {
    return step.result.message;
  }

  return typeof step.result === 'string' ? step.result : undefined;
};

/** A finished flow, from the log the interactions write; anything else (a note about one step) is not one. */
export const flowRunOf = (log: Log): FlowRun | undefined => {
  if (log.category !== 'interactions' || !isFlowParams(log.params)) {
    return undefined;
  }

  const { node, hostElementId, status, startTime, endTime, nodes } = log.params;
  const steps = Object.values(nodes)
    .filter(step => step.node.id !== node.id)
    .toSorted((a, b) => a.startTime - b.startTime)
    .map((step): FlowStep => {
      const refusal = refusalOf(step);
      const error = refusal ?? errorOf(step);

      return {
        title: step.node.title,
        action: step.node.action,
        status: refusal === undefined ? step.status : 'refused',
        ms: Math.round(step.endTime - step.startTime),
        ...(error === undefined ? {} : { error })
      };
    });

  return {
    at: log.time ?? '',
    trigger: `${node.title} [${node.action}]`,
    ...(hostElementId === undefined ? {} : { on: hostElementId }),
    status,
    ms: Math.round(endTime - startTime),
    steps
  };
};

/** One line for the console: what fired, where, and how it ended. */
export const flowRunLine = (run: FlowRun): string =>
  `[flow] ${run.trigger}${run.on ? ` on ${run.on}` : ''} → ${run.status} (${String(run.steps.length)} steps, ${String(run.ms)}ms)` +
  run.steps
    .filter(step => step.error !== undefined)
    .map(
      step => `\n  ${step.status === 'refused' ? 'refused' : '✗'} ${step.title} [${step.action}]: ${step.error ?? ''}`
    )
    .join('');
