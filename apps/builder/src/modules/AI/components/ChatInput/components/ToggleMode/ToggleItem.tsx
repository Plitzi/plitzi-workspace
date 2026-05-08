import clsx from 'clsx';
import { useCallback } from 'react';

import type { AiMode } from '@pmodules/AI/types';

export type ToggleItemProps = {
  mode: AiMode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: (mode: AiMode) => void;
};

const ToggleItem = ({ mode, active = false, disabled = false, title, onClick }: ToggleItemProps) => {
  const handleClick = useCallback(() => onClick?.(mode), [mode, onClick]);

  return (
    <button
      className={clsx(
        'cursor-pointer rounded px-2.5 py-0.5 font-mono text-[10px] capitalize transition-colors duration-200 disabled:opacity-40',
        {
          'bg-transparent text-zinc-400 dark:text-zinc-600': !active,
          'bg-emerald-500 text-white dark:bg-emerald-400': active && mode === 'build',
          'bg-sky-500 text-white dark:bg-sky-400': active && mode === 'plan'
        }
      )}
      onClick={handleClick}
      disabled={disabled}
      title={title}
    >
      {mode}
    </button>
  );
};

export default ToggleItem;
