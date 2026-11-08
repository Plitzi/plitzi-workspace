import clsx from 'clsx';
import { useCallback } from 'react';

import { FUNCTION_SIZE_NAMES, FUNCTION_SIZES } from '@plitzi/sdk-shared/functions';

import type { FunctionSize } from '@plitzi/sdk-shared';

export type TaskSizeProps = {
  /** The size the task runs at now. */
  size: FunctionSize;
  /** Whether the task asked for it, or gets the one every task gets. */
  asked: boolean;
  /** The sizes the space's plan includes, smallest first; the rest are shown locked. */
  allowed: readonly FunctionSize[];
  /** Why it cannot be changed from here right now — the code is still being read, say — or nothing. */
  disabledReason?: string;
  /** A size, written into the task's code. */
  onChange: (size: FunctionSize) => void;
};

const SIZE_LABELS: Record<FunctionSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

/**
 * How much memory one run of the task has, by size, written into the task as `limits: { size }`. The runner keeps it
 * whole for the run, so a larger size waits longer for room: a task starts small, and is made larger when a run says
 * it went over. What the plan does not include is shown locked, never hidden.
 */
const TaskSize = ({ size, asked, allowed, disabledReason = '', onChange }: TaskSizeProps) => {
  const handlePick = useCallback((picked: FunctionSize) => () => onChange(picked), [onChange]);
  const largest = allowed.at(-1);
  const locked = FUNCTION_SIZE_NAMES.some(name => !allowed.includes(name));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-1">
        {FUNCTION_SIZE_NAMES.map(name => {
          const included = allowed.includes(name);

          return (
            <button
              key={name}
              type="button"
              disabled={Boolean(disabledReason) || !included}
              title={included ? undefined : 'Not included in this space’s plan'}
              className={clsx(
                'flex flex-col items-center gap-0.5 rounded-md py-1.5 ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                {
                  'bg-primary-500 ring-primary-500 text-white': size === name,
                  'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800':
                    size !== name
                }
              )}
              onClick={handlePick(name)}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                {!included && <i className="fa-solid fa-lock text-[9px]" />}
                {SIZE_LABELS[name]}
              </span>
              <span className="font-mono text-[11px] opacity-80">{FUNCTION_SIZES[name].memoryMb} MB</span>
            </button>
          );
        })}
      </div>
      {disabledReason && <span className="text-[11px] text-amber-700 dark:text-amber-400">{disabledReason}</span>}
      {!disabledReason && (
        <span className="text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">
          {asked ? 'Memory per run, asked for in the code.' : 'Memory per run · the default.'} A run that holds more is
          stopped and says so; a larger size waits longer for room.
          {locked && largest && ` This space’s plan includes up to ${SIZE_LABELS[largest].toLowerCase()}.`}
        </span>
      )}
    </div>
  );
};

export default TaskSize;
