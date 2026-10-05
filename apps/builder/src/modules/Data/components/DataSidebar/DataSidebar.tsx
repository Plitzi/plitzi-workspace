import { useCallback, useMemo, useState } from 'react';

import { FileItem, FolderItem, NewFile, SidebarSection, fileRows } from '@pmodules/FileTree';

import { dataFileName } from '../../helpers';

export type DataSidebarProps = {
  files: string[];
  selectedFile: string;
  modified: string[];
  /** The files whose text is not JSON yet: marked, as a save would refuse them. */
  broken: string[];
  onSelectFile: (file: string) => void;
  onAddFile: (file: string) => void;
  onRemoveFile: (file: string) => void;
};

/** The data's files as a tree, the one that is open, and adding or removing one. */
const DataSidebar = ({
  files,
  selectedFile,
  modified,
  broken,
  onSelectFile,
  onAddFile,
  onRemoveFile
}: DataSidebarProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const rows = useMemo(() => fileRows(files), [files]);

  const handleStart = useCallback(() => setIsAdding(true), []);

  const handleStop = useCallback(() => setIsAdding(false), []);

  const handleAdd = useCallback(
    (file: string) => {
      onAddFile(file);
      setIsAdding(false);
    },
    [onAddFile]
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-auto border-r border-gray-200 bg-gray-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <SidebarSection title="Files" count={files.length} actionTitle="New file" onAction={handleStart}>
        {isAdding && (
          <NewFile placeholder="shop/products.json" nameOf={dataFileName} onAdd={handleAdd} onCancel={handleStop} />
        )}
        <div className="flex flex-col gap-0.5">
          {rows.map(row => (
            <div key={`${row.kind}:${row.path}`}>
              {row.kind === 'folder' && <FolderItem name={row.path.split('/').pop() ?? row.path} depth={row.depth} />}
              {row.kind === 'file' && (
                <FileItem
                  path={row.path}
                  name={row.name}
                  depth={row.depth}
                  selected={row.path === selectedFile}
                  modified={modified.includes(row.path) || broken.includes(row.path)}
                  removable
                  onSelect={onSelectFile}
                  onRemove={onRemoveFile}
                />
              )}
            </div>
          ))}
        </div>
      </SidebarSection>
      <p className="px-1 text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">
        A provider reads a file as <code>/data/&lt;path&gt;</code> on the server; what it reads is in the page it
        renders. Data a page must not carry belongs in a server action.
      </p>
    </aside>
  );
};

export default DataSidebar;
