import clsx from 'clsx';
import { useCallback } from 'react';

export type ExportFileTabProps = {
  path: string;
  selected: boolean;
  onSelect: (path: string) => void;
};

/** One file of a small export — the schema, the style — as a tab, where a list of two would be a waste of a column. */
const ExportFileTab = ({ path, selected, onSelect }: ExportFileTabProps) => {
  const handleClick = useCallback(() => onSelect(path), [onSelect, path]);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={handleClick}
      className={clsx(
        'flex h-6 cursor-pointer items-center gap-1.5 rounded px-2 font-mono text-xs transition-colors',
        selected && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50',
        !selected && 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      <i className="fa-regular fa-file-code text-[11px]" />
      {path}
    </button>
  );
};

export default ExportFileTab;
