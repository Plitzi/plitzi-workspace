// Packages
import classNames from 'classnames';
import { useCallback } from 'react';

// Types
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
      className={classNames(
        'flex w-full cursor-pointer border border-gray-300 rounded-sm px-2 py-1 gap-4 justify-between items-center',
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
