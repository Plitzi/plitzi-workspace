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
          <span className="text-ui-fg text-2xl leading-none font-semibold tabular-nums">{timeLabel(shown)}</span>
          <span className="text-ui-fg-subtle mt-1 text-[11px]">
            {asked ? 'of CPU per run' : 'of CPU per run · the default'}
          </span>
        </div>
        {asked && !disabledReason && (
          <button
            type="button"
            className="text-ui-fg-subtle hover:text-ui-fg text-[11px] underline-offset-2 hover:underline"
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
              'bg-ui-panel text-ui-fg ring-ui-line hover:bg-ui-hover': shown !== preset
            })}
            onClick={handlePreset(preset)}
          >
            {timeLabel(preset)}
          </button>
        ))}
      </div>
      {disabledReason && <span className="text-[11px] text-amber-700 dark:text-amber-400">{disabledReason}</span>}
      {!disabledReason && beyond && (
        <span className="text-ui-fg-subtle text-[11px]">Asked for in the code, above what the slider offers.</span>
      )}
      {!disabledReason && !beyond && (
        <span className="text-ui-fg-subtle text-[11px] leading-relaxed">
          A run that uses more is stopped. Waiting on a fetch does not count — only the time your code computes.
        </span>
      )}
    </div>
  );
};

export default TimeLimit;
