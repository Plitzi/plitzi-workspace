import clsx from 'clsx';
import { useCallback } from 'react';

export type ExportFileItemProps = {
  path: string;
  selected: boolean;
  onSelect: (path: string) => void;
};

const ExportFileItem = ({ path, selected, onSelect }: ExportFileItemProps) => {
  const handleClick = useCallback(() => onSelect(path), [onSelect, path]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={path}
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 truncate rounded px-2 py-1 text-left font-mono text-xs',
        selected && 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
        !selected && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
      )}
    >
      <i className="fa-regular fa-file-code shrink-0 text-[11px]" />
      <span className="truncate">{path}</span>
    </button>
  );
};

export default ExportFileItem;
