import clsx from 'clsx';
import { useCallback } from 'react';

export type ExportFileItemProps = {
  path: string;
  /** What the file is shown as — its name inside a folder, since the folder already says where it is. */
  label: string;
  /** Inside a folder: indented under it, beside the guide line the folder draws. */
  nested?: boolean;
  selected: boolean;
  onSelect: (path: string) => void;
};

const ExportFileItem = ({ path, label, nested = false, selected, onSelect }: ExportFileItemProps) => {
  const handleClick = useCallback(() => onSelect(path), [onSelect, path]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={path}
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 rounded py-1 pr-2 text-left font-mono text-xs',
        nested ? 'pl-3' : 'pl-2',
        selected && 'bg-primary-100 text-primary-800 dark:bg-primary-400/15 dark:text-primary-200',
        !selected && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
      )}
    >
      <i className="fa-regular fa-file-code shrink-0 text-[11px] opacity-70" />
      <span className="truncate">{label}</span>
    </button>
  );
};

export default ExportFileItem;
