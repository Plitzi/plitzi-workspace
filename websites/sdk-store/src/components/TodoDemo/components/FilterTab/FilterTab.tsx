import { useCallback } from 'react';

import type { TodoFilter } from '../../todoStore';

export type FilterTabProps = {
  value: TodoFilter;
  active: boolean;
  onSelect: (value: TodoFilter) => void;
};

const FilterTab = ({ value, active, onSelect }: FilterTabProps) => {
  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);

  return (
    <button
      onClick={handleClick}
      className={
        active
          ? 'flex-1 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium capitalize text-white'
          : 'flex-1 rounded-md px-3 py-1 text-xs font-medium capitalize text-zinc-400 transition hover:text-white'
      }
    >
      {value}
    </button>
  );
};

export default FilterTab;
