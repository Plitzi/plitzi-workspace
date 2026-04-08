import clsx from 'clsx';
import { useCallback } from 'react';

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
  const handleClick = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <div
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 border-l-2 px-2 py-1.5 transition-colors',
        {
          'border-l-violet-500 bg-violet-50 text-violet-700 dark:border-l-violet-500 dark:bg-violet-500/15 dark:text-violet-300':
            isSelected,
          'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-l-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100':
            !isSelected
        },
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
