import clsx from 'clsx';
import { useCallback } from 'react';

import { useDevToolsTheme } from '../../DevToolsThemeContext';

import type { ReactNode } from 'react';

export type ListItemProps = {
  className?: string;
  id?: string;
  label?: ReactNode;
  name?: string;
  isSelected?: boolean;
  onSelect?: (id?: string) => void;
};

const ListItem = ({ name, label, id, isSelected, className, onSelect }: ListItemProps) => {
  const { isDark } = useDevToolsTheme();
  const handleClick = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <div
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 border-l-2 px-2 py-1.5 transition-colors',
        isSelected
          ? isDark
            ? 'border-l-violet-500 bg-violet-500/15 text-violet-300'
            : 'border-l-violet-500 bg-violet-50 text-violet-700'
          : isDark
            ? 'border-l-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            : 'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        className
      )}
      onClick={handleClick}
    >
      <div className="truncate" title={name}>
        {label ?? name}
      </div>
    </div>
  );
};

export default ListItem;
