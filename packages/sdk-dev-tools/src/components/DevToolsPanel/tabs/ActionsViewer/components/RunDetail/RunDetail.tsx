import clsx from 'clsx';
import { useMemo } from 'react';

import PayloadView from '../../../../../PayloadView';
import {
  failedStep,
  formatMs,
  formatTime,
  isLive,
  MODE_LABEL,
  runDuration,
  statusTone,
  traceResultOf
} from '../../helpers';
import FlowTimeline from '../FlowTimeline';

import type { ActionRunEntry } from '@plitzi/sdk-shared';

const STATUS_PILL: Record<string, string> = {
  info: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  custom: 'bg-zinc-500/15 text-ui-fg-subtle'
};

/** Why a page is usually shown the outline and not the results: they are the author's own data. */
const OUTLINE_ONLY =
  'This page was sent what the flow DID, not what each step read or answered. Open the action in the builder, or run the deployment in dev mode, to inspect a step.';

const NO_STEPS =
  'The server did not send the steps for this run: the action is behind a session, or this page is not authorized to debug it.';

/** A run still in flight has no steps YET — a different thing from a server that withheld them. */
const STILL_RUNNING = 'The flow is still running. Its steps arrive with the answer.';

export type RunDetailProps = {
  run: ActionRunEntry;
  selectedStepId?: string;
  onSelectStep: (stepId: string) => void;
};

/** Everything known about one run: how it ended, what it did step by step, and what it carried. */
const RunDetail = ({ run, selectedStepId, onSelectStep }: RunDetailProps) => {
  const broke = failedStep(run.steps);
  const duration = runDuration(run);
  const stepResult = useMemo(
    () => (selectedStepId === undefined ? undefined : traceResultOf(run.trace, selectedStepId)),
    [run.trace, selectedStepId]
  );

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-ui-fg truncate text-xs font-medium">{run.actionId || '(no action named)'}</span>
        <span className={clsx('shrink-0 rounded px-1 py-0.5 text-[9px]', STATUS_PILL[statusTone(run.status)])}>
          {run.reason ?? run.status}
        </span>
      </div>

      {/* What broke and where, before anything else: the panel is short, and this is what the run was opened for. */}
      {run.error !== undefined && (
        <div className="mt-1 flex flex-col gap-1 rounded border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-500/30 dark:bg-red-500/10">
          <span className="font-medium text-red-600 dark:text-red-400">
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {broke === undefined ? 'The run failed' : `Failed at “${broke.title}”`}
          </span>
          <span className="break-words text-red-700 dark:text-red-300">{run.error}</span>
        </div>
      )}

      <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Flow</div>
      {run.steps === undefined && (
        <span className="text-ui-fg-subtle italic">{isLive(run) ? STILL_RUNNING : NO_STEPS}</span>
      )}
      {run.steps !== undefined && (
        <FlowTimeline steps={run.steps} selectedStepId={selectedStepId} onSelectStep={onSelectStep} />
      )}
      {selectedStepId !== undefined && stepResult === undefined && (
        <span className="text-ui-fg-subtle italic">{OUTLINE_ONLY}</span>
      )}
      {stepResult !== undefined && (
        <div className="border-ui-line overflow-auto rounded border">
          <PayloadView value={stepResult} />
        </div>
      )}

      <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Run</div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Mode</span>
        <span className="text-ui-fg">{MODE_LABEL[run.mode]}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Started</span>
        <span className="text-ui-fg tabular-nums">{formatTime(run.startedAt)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Took</span>
        <span className="text-ui-fg tabular-nums">{duration === undefined ? 'still running' : formatMs(duration)}</span>
      </div>
      {run.elementId !== undefined && (
        <div className="flex justify-between gap-2">
          <span className="text-ui-fg-subtle">Element</span>
          <span className="text-ui-fg-muted truncate font-mono">{run.elementId}</span>
        </div>
      )}
      {run.runId !== undefined && (
        <div className="flex flex-col gap-0.5">
          <span className="text-ui-fg-subtle">Run id</span>
          <span className="text-ui-fg-muted font-mono break-all">{run.runId}</span>
        </div>
      )}

      {run.input !== undefined && (
        <>
          <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Input</div>
          <div className="border-ui-line overflow-auto rounded border">
            <PayloadView value={run.input} />
          </div>
        </>
      )}
      {run.output !== undefined && (
        <>
          <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Output</div>
          <div className="border-ui-line overflow-auto rounded border">
            <PayloadView value={run.output} />
          </div>
        </>
      )}
      {run.progress.length > 0 && (
        <>
          <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">
            Progress ({run.progress.length})
          </div>
          <div className="border-ui-line overflow-auto rounded border">
            <PayloadView value={run.progress} />
          </div>
        </>
      )}
    </>
  );
};

export default RunDetail;
