import clsx from 'clsx';
import { useCallback } from 'react';

import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

export type ElementsListItemProps = {
  id?: string;
  name?: string;
  isSelected?: boolean;
  isVisible?: boolean;
  onSelect?: (id?: string) => void;
};

const ElementsListItem = ({ name, id, isSelected, isVisible = true, onSelect }: ElementsListItemProps) => {
  const { isDark } = useDevToolsTheme();
  const handleClickElement = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <div
      className={clsx(
        'flex w-full cursor-pointer items-center justify-between gap-2 border-l-2 px-2 py-1.5 transition-colors',
        isSelected
          ? isDark
            ? 'border-l-violet-500 bg-violet-500/15 text-violet-300'
            : 'border-l-violet-500 bg-violet-50 text-violet-700'
          : isDark
            ? 'border-l-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            : 'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      )}
      onClick={handleClickElement}
    >
      <div className="truncate" title={name}>
        {name}
      </div>
      <i
        className={clsx(
          'shrink-0 text-[10px]',
          isVisible
            ? isDark
              ? 'fa-solid fa-eye text-zinc-500'
              : 'fa-solid fa-eye text-zinc-400'
            : isDark
              ? 'fa-solid fa-eye-slash text-zinc-700'
              : 'fa-solid fa-eye-slash text-zinc-300'
        )}
      />
    </div>
  );
};

export default ElementsListItem;
