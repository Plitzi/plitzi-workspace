import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { durationLabel, jobControlsOf } from '../../../../helpers';

import type { JobControlAction, JobStatus, SpaceJob } from '@plitzi/sdk-shared';

export type JobRunProps = {
  job: SpaceJob;
  /** Answers why nothing changed, or nothing when it did. */
  onControl: (jobId: string, action: JobControlAction) => Promise<string | undefined>;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'Waiting',
  running: 'Running',
  paused: 'Paused',
  succeeded: 'Done',
  failed: 'Failed',
  dead: 'Out of attempts',
  cancelled: 'Cancelled'
};

const STATUS_TONE: Record<JobStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300',
  running: 'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  succeeded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  dead: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
};

const CONTROL_LABEL: Record<JobControlAction, string> = {
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel',
  retry: 'Run again'
};

/** What is being asked of it right now, when the worker holding it has not done it yet. */
const pendingAsk = (job: SpaceJob): string => {
  if (job.cancelRequested) {
    return 'Stopping…';
  }

  return job.pauseRequested ? 'Setting aside once it saves…' : '';
};

type ControlButtonProps = {
  action: JobControlAction;
  /** This control was pressed, and the queue has not answered yet. */
  busy: boolean;
  disabled: boolean;
  onControl: (action: JobControlAction) => Promise<void>;
};

const ControlButton = ({ action, busy, disabled, onControl }: ControlButtonProps) => {
  const handleClick = useCallback(() => void onControl(action), [action, onControl]);
  const label = busy ? '…' : CONTROL_LABEL[action];

  return (
    <Button size="xs" intent={action === 'cancel' ? 'danger' : undefined} disabled={disabled} onClick={handleClick}>
      {label}
    </Button>
  );
};

/** When it was last touched, as a time today or a date before. */
const touchedAt = (ms: number): string => {
  const at = new Date(ms);

  return at.toDateString() === new Date().toDateString() ? at.toLocaleTimeString() : at.toLocaleString();
};

/**
 * One run of a job: where it is, how far its code says it got, who started it, and the controls it takes now — each
 * answered by the queue, and what changed nothing says why under it.
 */
const JobRun = ({ job, onControl }: JobRunProps) => {
  const [busy, setBusy] = useState<JobControlAction | undefined>(undefined);
  const [refusal, setRefusal] = useState('');
  const controls = jobControlsOf(job);
  const asked = pendingAsk(job);
  const percent = typeof job.progress === 'number' ? Math.round(job.progress * 100) : undefined;
  const meta = [
    job.startedBy ? `by ${job.startedBy}` : '',
    `attempt ${String(job.attempts)} of ${String(job.maxAttempts)}`,
    job.activeMs ? `ran ${durationLabel(job.activeMs / 1000)}` : '',
    touchedAt(job.updatedAt)
  ].filter(Boolean);

  const handleControl = useCallback(
    async (action: JobControlAction) => {
      setBusy(action);
      setRefusal('');
      try {
        setRefusal((await onControl(job.id, action)) ?? '');
      } finally {
        setBusy(undefined);
      }
    },
    [job.id, onControl]
  );

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className={clsx('shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium', STATUS_TONE[job.status])}>
          {STATUS_LABEL[job.status]}
        </span>
        <code className="truncate text-[11px] text-gray-400 dark:text-zinc-500" title={job.id}>
          {job.id}
        </code>
      </div>
      {percent !== undefined && (
        <div className="flex flex-col gap-1">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Progress"
          >
            <div className="bg-primary-500 h-full rounded-full" style={{ width: `${String(percent)}%` }} />
          </div>
          <span className="text-gray-600 dark:text-zinc-300">
            {`${String(percent)}%${job.step ? ` · ${job.step}` : ''}`}
          </span>
        </div>
      )}
      <span className="text-gray-500 dark:text-zinc-400">{meta.join(' · ')}</span>
      {job.error && <span className="wrap-break-word text-red-600 dark:text-red-400">{job.error}</span>}
      {asked && <span className="text-amber-700 dark:text-amber-400">{asked}</span>}
      {controls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {controls.map(action => (
            <ControlButton
              key={action}
              action={action}
              busy={busy === action}
              disabled={busy !== undefined}
              onControl={handleControl}
            />
          ))}
        </div>
      )}
      {refusal && <span className="text-amber-700 dark:text-amber-400">{refusal}</span>}
    </li>
  );
};

export default JobRun;
