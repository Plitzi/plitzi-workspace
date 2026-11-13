import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { fileNameOf } from '../../../../helpers/exportFiles';
import ExportFileItem from '../ExportFileItem';

import type { FileFolder } from '../../../../helpers/exportFiles';

export type ExportFileFolderProps = {
  folder: FileFolder;
  selectedPath?: string;
  onSelect: (path: string) => void;
};

/** A folder of the export — the layouts, the pages — that folds away, its files indented under a guide line. */
const ExportFileFolder = ({ folder, selectedPath, onSelect }: ExportFileFolderProps) => {
  const [open, setOpen] = useState(true);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="text-ui-fg hover:bg-ui-hover flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs font-medium"
      >
        <i
          className={clsx(
            'fa-solid fa-chevron-right text-ui-fg-subtle w-2.5 shrink-0 text-[9px] transition-transform',
            open && 'rotate-90'
          )}
        />
        <i
          className={clsx(
            'text-primary-500 dark:text-primary-300 shrink-0 text-[11px]',
            open ? 'fa-solid fa-folder-open' : 'fa-solid fa-folder'
          )}
        />
        <span className="grow truncate">{folder.name}</span>
        <span className="text-ui-fg-subtle text-[11px]">{folder.paths.length}</span>
      </button>
      {open && (
        <div className="border-ui-line mt-0.5 ml-[13px] space-y-0.5 border-l pl-1">
          {folder.paths.map(path => (
            <ExportFileItem
              key={path}
              path={path}
              label={fileNameOf(path)}
              nested
              selected={path === selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportFileFolder;
