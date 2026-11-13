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
        selected && 'border-primary-500 text-ui-fg',
        !selected && 'text-ui-fg-subtle hover:text-ui-fg border-transparent'
      )}
    >
      <i className={clsx(icon, 'text-[11px]')} />
      {label}
      {count !== undefined && (
        <span className="bg-ui-active text-ui-fg-muted rounded-full px-1.5 text-[11px] leading-4">{count}</span>
      )}
    </button>
  );
};

export default ExportViewTab;
