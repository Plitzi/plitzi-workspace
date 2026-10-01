import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';

import { TIME_LIMIT, timeLabel } from '../../../../helpers';

import type { ChangeEvent } from 'react';

export type TimeLimitProps = {
  /** The CPU the task runs with now. */
  ms: number;
  /** Whether the task asked for it, or gets the default. */
  asked: boolean;
  /** Why it cannot be changed from here right now — the code is still being read, say — or nothing. */
  disabledReason?: string;
  /** A new limit, or `undefined` to take it out and run with the default. Written into the task's code. */
  onChange: (cpuMs: number | undefined) => void;
};

/**
 * How much CPU one run of the task may use before it is stopped: a slider and the usual values, written into the task
 * as `limits: { cpuMs }` — the code stays the one place it is said, and the panel follows it when it is typed there.
 */
const TimeLimit = ({ ms, asked, disabledReason = '', onChange }: TimeLimitProps) => {
  // The value under the thumb while it is dragged, and the one written until the code reads it back.
  const [held, setHeld] = useState<number | undefined>(undefined);
  const shown = held ?? ms;
  const beyond = shown > TIME_LIMIT.max;

  useEffect(() => {
    setHeld(undefined);
  }, [ms, asked]);

  const handleSlide = useCallback((e: ChangeEvent<HTMLInputElement>) => setHeld(Number(e.target.value)), []);

  const handleCommit = useCallback(() => {
    if (held !== undefined && held !== ms) {
      onChange(held);
    }
  }, [held, ms, onChange]);

  const handlePreset = useCallback(
    (preset: number) => () => {
      setHeld(preset);
      onChange(preset);
    },
    [onChange]
  );

  const handleDefault = useCallback(() => onChange(undefined), [onChange]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-2xl leading-none font-semibold text-gray-900 tabular-nums dark:text-zinc-50">
            {timeLabel(shown)}
          </span>
          <span className="mt-1 text-[11px] text-gray-500 dark:text-zinc-400">
            {asked ? 'of CPU per run' : 'of CPU per run · the default'}
          </span>
        </div>
        {asked && !disabledReason && (
          <button
            type="button"
            className="text-[11px] text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={handleDefault}
          >
            Use default
          </button>
        )}
      </div>
      <input
        type="range"
        aria-label="CPU per run"
        className="accent-primary-500 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        min={TIME_LIMIT.min}
        max={TIME_LIMIT.max}
        step={TIME_LIMIT.step}
        value={Math.min(shown, TIME_LIMIT.max)}
        disabled={Boolean(disabledReason)}
        onChange={handleSlide}
        onPointerUp={handleCommit}
        onKeyUp={handleCommit}
        onBlur={handleCommit}
      />
      <div className="grid grid-cols-4 gap-1">
        {TIME_LIMIT.presets.map(preset => (
          <button
            key={preset}
            type="button"
            disabled={Boolean(disabledReason)}
            className={clsx('rounded-md py-1 font-mono text-[11px] ring-1 transition-colors disabled:opacity-50', {
              'bg-primary-500 ring-primary-500 text-white': shown === preset,
              'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800':
                shown !== preset
            })}
            onClick={handlePreset(preset)}
          >
            {timeLabel(preset)}
          </button>
        ))}
      </div>
      {disabledReason && <span className="text-[11px] text-amber-700 dark:text-amber-400">{disabledReason}</span>}
      {!disabledReason && beyond && (
        <span className="text-[11px] text-gray-500 dark:text-zinc-400">
          Asked for in the code, above what the slider offers.
        </span>
      )}
      {!disabledReason && !beyond && (
        <span className="text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">
          A run that uses more is stopped. Waiting on a fetch does not count — only the time your code computes.
        </span>
      )}
    </div>
  );
};

export default TimeLimit;
