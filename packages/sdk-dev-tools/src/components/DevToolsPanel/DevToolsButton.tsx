import clsx from 'clsx';

import type { MouseEvent } from 'react';

export type DevToolsButtonProps = {
  className?: string;
  isSelected?: boolean;
  iconClassName?: string;
  title?: string;
  /** Offered and not to be pressed now: its title says why. */
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
};

const DevToolsButton = ({
  className,
  iconClassName,
  title,
  isSelected = false,
  disabled = false,
  onClick
}: DevToolsButtonProps) => {
  return (
    <button
      className={clsx(
        'flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        {
          'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400': isSelected,
          'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100':
            !isSelected
        },
        className
      )}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <i className={clsx('text-xs', iconClassName)} />
    </button>
  );
};

export default DevToolsButton;
