import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

import type { ReactNode } from 'react';

export type ResourceRowProps = {
  id: string;
  /** A Font Awesome class for the tile at the start of the row. */
  icon?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A state worth seeing without opening it: disabled, in use, unsaved. */
  badge?: ReactNode;
  removeTitle?: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
};

/**
 * One item of a view's list: the row opens it, the bin removes it. Two buttons side by side, never one inside the
 * other, so each is reachable and announced on its own.
 */
const ResourceRow = ({
  id,
  icon,
  title,
  subtitle,
  badge,
  removeTitle = 'Remove',
  onSelect,
  onRemove
}: ResourceRowProps) => {
  const handleSelect = useCallback(() => onSelect(id), [id, onSelect]);
  const handleRemove = useCallback(() => onRemove?.(id), [id, onRemove]);

  return (
    <div className="group hover:border-primary-300 dark:hover:border-primary-400/40 flex items-center gap-1 rounded-lg border border-gray-200 bg-white pr-2 transition-colors duration-150 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        className="focus-visible:ring-primary-500/40 flex min-w-0 grow cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
        onClick={handleSelect}
      >
        {icon && (
          <span className="group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-400/15 dark:group-hover:text-primary-300 flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
            <i className={icon} />
          </span>
        )}
        <span className="flex min-w-0 grow flex-col">
          <span className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
            {badge}
          </span>
          {subtitle && <span className="truncate font-mono text-xs text-gray-500 dark:text-zinc-400">{subtitle}</span>}
        </span>
        <i className="fa-solid fa-chevron-right group-hover:text-primary-500 text-[10px] text-gray-300 dark:text-zinc-600" />
      </button>
      {onRemove && (
        <Button
          size="xs"
          intent="secondary"
          border="none"
          className="text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
          title={removeTitle}
          onClick={handleRemove}
        >
          <Button.Icon icon="fa-regular fa-trash-can" />
        </Button>
      )}
    </div>
  );
};

export default ResourceRow;
