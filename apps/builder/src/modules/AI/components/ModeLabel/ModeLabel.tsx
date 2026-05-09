import clsx from 'clsx';

import type { AiMode } from '@pmodules/AI/types';

export type ModeLabelProps = { mode?: AiMode };

const ModeLabel = ({ mode = 'build' }: ModeLabelProps) => {
  return (
    <span
      className={clsx('rounded border px-1.5 py-px font-mono text-[8px] tracking-wider uppercase', {
        'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
          mode === 'build',
        'border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
          mode === 'plan'
      })}
    >
      {mode}
    </span>
  );
};

export default ModeLabel;
