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
        'flex w-full cursor-pointer items-center justify-between gap-4 rounded-sm border border-gray-300 px-2 py-1',
        { 'bg-purple-300': isSelected, 'hover:bg-purple-200': !isSelected },
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
