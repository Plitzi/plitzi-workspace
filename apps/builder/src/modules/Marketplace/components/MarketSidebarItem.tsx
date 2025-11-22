import clsx from 'clsx';
import { useCallback } from 'react';

export type MarketSidebarItemProps = {
  id?: string;
  isSelected?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: (id: string) => void;
};

const MarketSidebarItem = ({
  id = '',
  isSelected = false,
  className = '',
  children,
  onClick
}: MarketSidebarItemProps) => {
  const handleClick = useCallback(() => onClick?.(id), [onClick, id]);

  return (
    <li
      className={clsx('flex cursor-pointer items-center justify-center py-2 select-none', className, {
        'font-bold text-blue-400': isSelected,
        'hover:text-blue-400': !isSelected
      })}
      onClick={handleClick}
    >
      {children}
    </li>
  );
};

export default MarketSidebarItem;
