import clsx from 'clsx';
import { useCallback } from 'react';

export type ElementsListItemProps = {
  id?: string;
  name?: string;
  isSelected?: boolean;
  isVisible?: boolean;
  onSelect?: (id?: string) => void;
};

const ElementsListItem = ({ name, id, isSelected, isVisible = true, onSelect }: ElementsListItemProps) => {
  const handleClickElement = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <div
      className={clsx(
        'flex w-full cursor-pointer items-center justify-between gap-2 border-l-2 px-2 py-1.5 transition-colors',
        {
          'border-l-violet-500 bg-violet-50 text-violet-700 dark:border-l-violet-500 dark:bg-violet-500/15 dark:text-violet-300':
            isSelected,
          'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-l-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100':
            !isSelected
        }
      )}
      onClick={handleClickElement}
    >
      <div className="truncate" title={name}>
        {name}
      </div>
      <i
        className={clsx('shrink-0 text-[10px]', {
          'fa-solid fa-eye text-zinc-400 dark:text-zinc-500': isVisible,
          'fa-solid fa-eye-slash text-zinc-300 dark:text-zinc-700': !isVisible
        })}
      />
    </div>
  );
};

export default ElementsListItem;
