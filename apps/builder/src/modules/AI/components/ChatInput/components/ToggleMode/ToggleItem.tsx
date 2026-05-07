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
      className={clsx('cursor-pointer rounded px-2.5 py-0.5 capitalize transition-colors duration-200', {
        'bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-900': active && mode === 'build',
        'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-900': active && mode === 'plan',
        'dark:text-zinc-700': !active
      })}
      onClick={handleClick}
      disabled={disabled}
      title={title}
    >
      {mode}
    </button>
  );
};

export default ToggleItem;
