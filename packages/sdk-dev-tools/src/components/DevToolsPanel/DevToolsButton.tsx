import clsx from 'clsx';

import { useDevToolsTheme } from '../../DevToolsThemeContext';

import type { MouseEvent } from 'react';

export type DevToolsButtonProps = {
  className?: string;
  isSelected?: boolean;
  iconClassName?: string;
  title?: string;
  onClick?: (e?: MouseEvent) => void;
};

const DevToolsButton = ({ className, iconClassName, title, isSelected = false, onClick }: DevToolsButtonProps) => {
  const { isDark } = useDevToolsTheme();

  return (
    <button
      className={clsx(
        'flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors',
        isSelected
          ? isDark
            ? 'bg-violet-500/20 text-violet-400'
            : 'bg-violet-500/10 text-violet-600'
          : isDark
            ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900',
        className
      )}
      title={title}
      onClick={onClick}
    >
      <i className={clsx('text-xs', iconClassName)} />
    </button>
  );
};

export default DevToolsButton;
