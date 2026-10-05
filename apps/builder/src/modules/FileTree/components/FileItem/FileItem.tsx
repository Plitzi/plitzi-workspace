import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

import { FILE_INDENT_PX } from '../../helpers';

import type { MouseEvent } from 'react';

export type FileItemProps = {
  path: string;
  name: string;
  depth: number;
  selected: boolean;
  modified: boolean;
  /** Whether it may be removed — not the file everything starts from (the functions' `index.ts`). */
  removable: boolean;
  onSelect: (file: string) => void;
  onRemove: (file: string) => void;
};

/** One file in the list: opened with a click, marked while it has unsaved changes, removed from its own button. */
const FileItem = ({ path, name, depth, selected, modified, removable, onSelect, onRemove }: FileItemProps) => {
  const handleSelect = useCallback(() => onSelect(path), [onSelect, path]);

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(path);
    },
    [onRemove, path]
  );

  return (
    <div
      className={clsx(
        'group flex cursor-pointer items-center justify-between gap-1 rounded-sm py-1 pr-1 font-mono text-xs',
        {
          'bg-blue-100 text-blue-900 dark:bg-zinc-700 dark:text-zinc-100': selected,
          'hover:bg-gray-100 dark:hover:bg-zinc-800': !selected
        }
      )}
      style={{ paddingLeft: 8 + depth * FILE_INDENT_PX }}
      title={path}
      onClick={handleSelect}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <i className="fa-regular fa-file-code shrink-0 text-[10px] text-gray-400 dark:text-zinc-500" />
        <span className="truncate">{name}</span>
        {modified && (
          <span className="text-amber-600 dark:text-amber-400" title="Unsaved changes">
            ●
          </span>
        )}
      </span>
      {removable && (
        <Button
          size="xs"
          intent="secondary"
          className="invisible group-hover:visible"
          title={`Remove ${path}`}
          onClick={handleRemove}
        >
          <i className="fa-regular fa-trash-can" />
        </Button>
      )}
    </div>
  );
};

export default FileItem;
