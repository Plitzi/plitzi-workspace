import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import type { MouseEvent } from 'react';

export type FunctionsFilesProps = {
  files: string[];
  selected: string;
  /** The files whose text differs from what was last saved. */
  modified: string[];
  onSelect: (file: string) => void;
  onAdd: (file: string) => void;
  onRemove: (file: string) => void;
};

const FunctionsFiles = ({ files, selected, modified, onSelect, onAdd, onRemove }: FunctionsFilesProps) => {
  const [name, setName] = useState('');

  const handleSelect = useCallback((file: string) => () => onSelect(file), [onSelect]);

  const handleRemove = useCallback(
    (file: string) => (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(file);
    },
    [onRemove]
  );

  const handleAdd = useCallback(() => {
    const file = name.trim();
    if (!file) {
      return;
    }

    onAdd(file);
    setName('');
  }, [name, onAdd]);

  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 border-r border-gray-300 p-2 dark:border-zinc-600">
      <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400">Files</span>
      <div className="flex flex-col gap-1 overflow-auto">
        {files.map(file => (
          <div
            key={file}
            className={clsx(
              'group flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 font-mono text-xs',
              {
                'bg-blue-100 text-blue-900 dark:bg-zinc-700 dark:text-zinc-100': file === selected,
                'hover:bg-gray-100 dark:hover:bg-zinc-800': file !== selected
              }
            )}
            onClick={handleSelect(file)}
          >
            <span className="truncate">
              {file}
              {modified.includes(file) && <span className="ml-1 text-amber-600 dark:text-amber-400">●</span>}
            </span>
            {file !== 'index.ts' && (
              <Button size="xs" intent="danger" className="invisible group-hover:visible" onClick={handleRemove(file)}>
                <i className="fa-solid fa-trash" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-1">
        <Input size="xs" value={name} placeholder="lib/feed.ts" onChange={setName} />
        <Button size="xs" disabled={!name.trim()} onClick={handleAdd}>
          Add
        </Button>
      </div>
    </div>
  );
};

export default FunctionsFiles;
