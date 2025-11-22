import clsx from 'clsx';
import { useCallback } from 'react';

export type FilterCategoryProps = {
  className?: string;
  id?: string;
  active?: boolean;
  name?: string;
  onClick?: (id: string) => void;
};

const FilterCategory = ({
  className = '',
  id = '',
  active = false,
  name = 'Category',
  onClick
}: FilterCategoryProps) => {
  const handleClick = useCallback(() => onClick?.(id), [id, onClick]);

  return (
    <div
      className={clsx(
        'flex grow basis-0 cursor-pointer items-center justify-center px-2 py-1.5 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-gray-300',
        className,
        { 'bg-blue-100 font-bold': active }
      )}
      onClick={handleClick}
    >
      {name}
    </div>
  );
};

export default FilterCategory;
