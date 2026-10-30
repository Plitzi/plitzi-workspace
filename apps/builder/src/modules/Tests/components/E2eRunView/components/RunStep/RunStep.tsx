import clsx from 'clsx';
import { useCallback } from 'react';

import type { TSpaceE2eStepResult } from '@plitzi/sdk-shared/network';

export type RunStepProps = {
  index: number;
  step: TSpaceE2eStepResult;
  shown: boolean;
  onShow: (index: number) => void;
};

/** One step of a run, as the log says it: its mark, its words, how long it took — what it read, when it failed. */
const RunStep = ({ index, step, shown, onShow }: RunStepProps) => {
  const handleClick = useCallback(() => onShow(index), [index, onShow]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        shown
          ? 'border-primary-500 bg-primary-50/60 dark:border-primary-400 dark:bg-primary-400/10'
          : 'border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60'
      )}
    >
      <span className="w-5 shrink-0 font-mono text-xs text-gray-400 dark:text-zinc-500">{index + 1}</span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate font-mono text-xs text-zinc-900 dark:text-zinc-100">{step.said}</span>
        {step.read && <span className="text-xs text-red-600 dark:text-red-400">{step.read}</span>}
      </span>
      {step.notRun && <span className="text-xs text-gray-400 dark:text-zinc-500">not run</span>}
      {!step.notRun && (
        <span
          className={clsx(
            'text-xs',
            step.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {step.ok ? '✓' : '✗'} {(step.ms / 1000).toFixed(1)} s
        </span>
      )}
    </button>
  );
};

export default RunStep;
