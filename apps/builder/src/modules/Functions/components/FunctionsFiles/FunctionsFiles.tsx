import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useMemo, useState } from 'react';

import FileItem from './components/FileItem';
import FolderItem from './components/FolderItem';
import NewFile from './components/NewFile';
import { fileRows } from '../../helpers';

export type FunctionsFilesProps = {
  files: string[];
  selected: string;
  /** The files whose text differs from what was last saved. */
  modified: string[];
  onSelect: (file: string) => void;
  onAdd: (file: string) => void;
  onRemove: (file: string) => void;
};

/**
 * The functions' files as a tree: folders once, before what is in them, and every file a click from the editor. A new
 * one is named where the list starts, and a file with unsaved changes says so.
 */
const FunctionsFiles = ({ files, selected, modified, onSelect, onAdd, onRemove }: FunctionsFilesProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const rows = useMemo(() => fileRows(files), [files]);

  const handleStartAdding = useCallback(() => setIsAdding(true), []);

  const handleStopAdding = useCallback(() => setIsAdding(false), []);

  const handleAdd = useCallback(
    (file: string) => {
      onAdd(file);
      setIsAdding(false);
    },
    [onAdd]
  );

  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 border-r border-gray-200 p-2 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Files</span>
        <Button size="xs" intent="secondary" title="New file" onClick={handleStartAdding}>
          <i className="fa-solid fa-plus" />
        </Button>
      </div>
      {isAdding && <NewFile onAdd={handleAdd} onCancel={handleStopAdding} />}
      <div className="flex flex-col gap-0.5 overflow-auto">
        {rows.map(row => (
          <div key={`${row.kind}:${row.path}`}>
            {row.kind === 'folder' && <FolderItem name={row.path.split('/').pop() ?? row.path} depth={row.depth} />}
            {row.kind === 'file' && (
              <FileItem
                path={row.path}
                name={row.name}
                depth={row.depth}
                selected={row.path === selected}
                modified={modified.includes(row.path)}
                removable={row.path !== 'index.ts'}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FunctionsFiles;
