import clsx from 'clsx';
import { useCallback } from 'react';

export type ExportView = 'code' | 'changes';

export type ExportViewTabProps = {
  view: ExportView;
  label: string;
  icon: string;
  /** Shown beside the label as a count, when there is one. */
  count?: number;
  selected: boolean;
  onSelect: (view: ExportView) => void;
};

const ExportViewTab = ({ view, label, icon, count, selected, onSelect }: ExportViewTabProps) => {
  const handleClick = useCallback(() => onSelect(view), [onSelect, view]);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={handleClick}
      className={clsx(
        '-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
        selected && 'border-violet-500 text-zinc-900 dark:text-zinc-50',
        !selected && 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
      )}
    >
      <i className={clsx(icon, 'text-[11px]')} />
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] leading-4 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {count}
        </span>
      )}
    </button>
  );
};

export default ExportViewTab;
