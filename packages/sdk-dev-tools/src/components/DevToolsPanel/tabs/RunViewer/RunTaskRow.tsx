import clsx from 'clsx';
import { useCallback, useState } from 'react';

import type { RunSnapshotTask } from '@plitzi/sdk-shared/runs';

const ICON: Record<string, string> = {
  pending: 'fa-regular fa-circle',
  spike: 'fa-solid fa-flask',
  ready: 'fa-regular fa-circle-dot',
  'in-progress': 'fa-solid fa-play',
  waiting: 'fa-solid fa-hourglass-half',
  'in-review': 'fa-solid fa-magnifying-glass',
  'changes-requested': 'fa-solid fa-rotate-left',
  done: 'fa-solid fa-check',
  blocked: 'fa-solid fa-ban',
  failed: 'fa-solid fa-xmark'
};

const TONE: Record<string, string> = {
  done: 'text-emerald-600 dark:text-emerald-400',
  'in-review': 'text-violet-600 dark:text-violet-400',
  'in-progress': 'text-sky-600 dark:text-sky-400',
  'changes-requested': 'text-amber-600 dark:text-amber-400',
  spike: 'text-blue-600 dark:text-blue-400',
  blocked: 'text-red-600 dark:text-red-400',
  failed: 'text-red-600 dark:text-red-400'
};

/** Who has it, in a line: its agent — and, in review, the lead reviewing it. */
const whoOf = (task: RunSnapshotTask): string =>
  [task.agent, task.reviewer ? `reviewed by ${task.reviewer}` : undefined].filter(Boolean).join(' · ');

/** Its urgency as the terminal's monitor marks it — ‼ critical, ! high — and nothing once it is approved. */
const UrgencyMark = ({ task }: { task: RunSnapshotTask }) => {
  if (task.status === 'done' || (task.urgency !== 'critical' && task.urgency !== 'high')) {
    return null;
  }

  return (
    <span
      title={`${task.urgency}: its priority, or that of a task waiting on it`}
      className={clsx(
        'shrink-0 text-[10px] font-bold',
        task.urgency === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
      )}
    >
      {task.urgency === 'critical' ? '‼' : '!'}
    </span>
  );
};

/** One task of the run: its state, who has it, how far, why it waits — and, opened, the files it writes. */
const RunTaskRow = ({ task }: { task: RunSnapshotTask }) => {
  const [open, setOpen] = useState(false);
  const handleToggle = useCallback(() => setOpen(was => !was), []);

  return (
    <div className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <i className={clsx(ICON[task.status] ?? 'fa-regular fa-circle', 'w-3 text-[10px]', TONE[task.status])} />
        <UrgencyMark task={task} />
        <span className="shrink-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{task.id}</span>
        <span className="min-w-0 grow truncate">{task.title}</span>
        {task.fraction !== undefined && (
          <span className="shrink-0 text-[10px] text-zinc-400">{Math.round(task.fraction * 100)} %</span>
        )}
        <span className="shrink-0 text-[10px] text-zinc-400">{whoOf(task)}</span>
      </button>
      {task.why && (
        <div
          className={clsx(
            'truncate px-7 pb-1 text-[10px]',
            task.status === 'blocked' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
          )}
          title={task.why}
        >
          {task.why}
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-0.5 px-7 pb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>
            {task.status}
            {task.round > 0 ? ` · round ${String(task.round)}` : ''} · {task.role}
            {task.step ? ` · ${task.step}` : ''}
          </span>
          {task.files.map(file => (
            <span key={file} className="font-mono">
              {file}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunTaskRow;
