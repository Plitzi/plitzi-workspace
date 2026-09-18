import clsx from 'clsx';
import { useCallback } from 'react';

import type { ExportFormat, ExportFormatOption } from '../../../../helpers/exportFormats';

export type ExportFormatButtonProps = {
  option: ExportFormatOption;
  selected: boolean;
  onSelect: (format: ExportFormat) => void;
};

const ExportFormatButton = ({ option, selected, onSelect }: ExportFormatButtonProps) => {
  const handleClick = useCallback(() => onSelect(option.value), [onSelect, option.value]);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={handleClick}
      className={clsx(
        'flex h-7 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
        selected && 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50',
        !selected && 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      <i className={clsx(option.icon, 'text-[11px]')} />
      {option.label}
    </button>
  );
};

export default ExportFormatButton;
