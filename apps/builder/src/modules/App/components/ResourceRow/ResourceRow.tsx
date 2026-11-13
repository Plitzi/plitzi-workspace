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
    <div className="group hover:border-primary-300 dark:hover:border-primary-400/40 border-ui-line bg-ui-panel flex items-center gap-1 rounded-lg border pr-2 transition-colors duration-150">
      <button
        type="button"
        className="focus-visible:ring-primary-500/40 flex min-w-0 grow cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
        onClick={handleSelect}
      >
        {icon && (
          <span className="group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-400/15 dark:group-hover:text-primary-300 bg-ui-raised text-ui-fg-subtle flex size-8 shrink-0 items-center justify-center rounded-md text-xs">
            <i className={icon} />
          </span>
        )}
        <span className="flex min-w-0 grow flex-col">
          <span className="text-ui-fg flex items-center gap-2 truncate text-sm font-medium">
            {title}
            {badge}
          </span>
          {subtitle && <span className="text-ui-fg-subtle truncate font-mono text-xs">{subtitle}</span>}
        </span>
        <i className="fa-solid fa-chevron-right group-hover:text-primary-500 text-ui-fg-subtle text-[10px]" />
      </button>
      {onRemove && (
        <Button
          size="xs"
          intent="secondary"
          border="none"
          className="text-ui-fg-subtle hover:text-red-600 dark:hover:text-red-400"
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
