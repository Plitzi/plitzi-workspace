import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

import LogStatusIcon from '../../../Logs/LogStatusIcon';
import {
  failedStep,
  formatMs,
  formatTime,
  isLive,
  MODE_ICON,
  MODE_LABEL,
  runDuration,
  statusTone,
  stepCount
} from '../../helpers';

import type { ActionRunEntry } from '@plitzi/sdk-shared';

const STATUS_ICON: Record<string, string> = {
  running: 'fa-solid fa-circle-notch fa-spin',
  streaming: 'fa-solid fa-circle-notch fa-spin',
  accepted: 'fa-solid fa-paper-plane',
  completed: 'fa-solid fa-check',
  failed: 'fa-solid fa-xmark',
  aborted: 'fa-solid fa-hand',
  skipped: 'fa-solid fa-forward'
};

const BORDER_TONE: Record<string, string> = {
  info: 'border-l-violet-400',
  success: 'border-l-emerald-400',
  danger: 'border-l-red-400',
  warning: 'border-l-amber-400',
  custom: 'border-l-ui-line-strong'
};

export type RunRowProps = {
  run: ActionRunEntry;
  selected: boolean;
  onSelect: (runId: string) => void;
  onCancel: (runId: string) => void;
};

/** One run in the log: enough to recognise it, and enough to tell a healthy one from the one to open. */
const RunRow = ({ run, selected, onSelect, onCancel }: RunRowProps) => {
  const handleSelect = useCallback(() => onSelect(run.id), [onSelect, run.id]);
  const handleCancel = useCallback(() => onCancel(run.id), [onCancel, run.id]);
  const broke = failedStep(run.steps);
  const duration = runDuration(run);

  return (
    // Cancel sits beside the row rather than inside it: nested buttons are invalid markup.
    <div
      className={clsx('flex items-center gap-2 border-b border-l-2 px-2', BORDER_TONE[statusTone(run.status)], {
        'border-b-ui-line bg-violet-500/5': selected,
        'border-b-ui-line hover:bg-ui-hover': !selected
      })}
    >
      <button type="button" className="flex grow flex-col gap-0.5 py-1.5 text-left" onClick={handleSelect}>
        <div className="flex items-center gap-1.5 text-[11px]">
          <LogStatusIcon logType={statusTone(run.status)} iconClassName={STATUS_ICON[run.status]} />
          <span className="text-ui-fg truncate font-medium">{run.actionId || '(no action named)'}</span>
          <span
            className="bg-ui-raised text-ui-fg-subtle flex shrink-0 items-center gap-1 rounded-sm px-1 text-[9px] uppercase"
            title={run.mode === 'render' ? 'Run by the server while it built this page' : undefined}
          >
            <i className={MODE_ICON[run.mode]} />
            {MODE_LABEL[run.mode]}
          </span>
          <span className="text-ui-fg-subtle ml-auto shrink-0 tabular-nums">
            {duration === undefined ? '…' : formatMs(duration)}
          </span>
        </div>
        <div className="text-ui-fg-subtle flex items-center gap-1.5 text-[10px]">
          <span className="shrink-0 tabular-nums">{formatTime(run.startedAt)}</span>
          {run.steps !== undefined && <span className="shrink-0">{stepCount(run.steps.length)}</span>}
          {run.elementId !== undefined && <span className="truncate font-mono">{run.elementId}</span>}
          {broke !== undefined && (
            <span className="truncate text-red-500 dark:text-red-400">
              <i className="fa-solid fa-circle-exclamation mr-1" />
              {broke.title}
            </span>
          )}
          {broke === undefined && run.reason !== undefined && (
            <span className="truncate text-amber-600 dark:text-amber-400">{run.reason}</span>
          )}
        </div>
      </button>
      {isLive(run) && run.cancellable === true && (
        <Button size="xs" intent="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};

export default RunRow;
