import clsx from 'clsx';
import { useCallback } from 'react';

export type CategoryChipProps = {
  id: string;
  label: string;
  icon: string;
  count: number;
  active: boolean;
  onSelect: (id: string) => void;
};

/** One category to show, chosen in a row of them: its name, how many it holds, and whether it is the one shown. */
const CategoryChip = ({ id, label, icon, count, active, onSelect }: CategoryChipProps) => {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={`${label} — ${String(count)}`}
      className={clsx(
        'flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition-colors',
        {
          'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-400/40 dark:bg-primary-400/15 dark:text-primary-200':
            active,
          'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800':
            !active
        }
      )}
      onClick={handleClick}
    >
      <i className={clsx(icon, 'text-[10px]')} />
      {label}
      <span className="text-gray-400 tabular-nums dark:text-zinc-500">{count}</span>
    </button>
  );
};

export default CategoryChip;
