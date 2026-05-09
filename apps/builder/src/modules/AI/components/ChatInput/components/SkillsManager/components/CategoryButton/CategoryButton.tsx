import clsx from 'clsx';
import { useCallback } from 'react';

import type { Category } from '../../helpers';
import type { AiSkillCategory } from '@pmodules/AI/types';

export type CategoryButtonProps = {
  category: Category;
  isActive: boolean;
  count: number;
  onSelect: (id: AiSkillCategory | 'all') => void;
};

const CategoryButton = ({ category, isActive, count, onSelect }: CategoryButtonProps) => {
  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [category.id, onSelect]);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
        isActive
          ? 'bg-neutral-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          : 'text-zinc-500 hover:bg-neutral-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
      )}
    >
      <span className="flex-1">{category.label}</span>
      <span className="font-mono text-[9.5px] text-zinc-400 dark:text-zinc-600">{count}</span>
    </button>
  );
};

export default CategoryButton;
