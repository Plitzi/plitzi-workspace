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
          'text-ui-fg-muted hover:bg-ui-hover hover:text-ui-fg border-l-transparent dark:border-l-transparent':
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
