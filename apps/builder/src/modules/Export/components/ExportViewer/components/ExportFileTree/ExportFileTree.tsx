import { useMemo } from 'react';

import { fileTreeOf } from '../../../../helpers/exportFiles';
import ExportFileFolder from '../ExportFileFolder';
import ExportFileItem from '../ExportFileItem';

export type ExportFileTreeProps = {
  paths: string[];
  selectedPath?: string;
  onSelect: (path: string) => void;
};

/** The export's files as the folders they are written into: the space's own files first, then each folder. */
const ExportFileTree = ({ paths, selectedPath, onSelect }: ExportFileTreeProps) => {
  const tree = useMemo(() => fileTreeOf(paths), [paths]);

  return (
    <nav className="w-64 shrink-0 space-y-1 overflow-auto border-r border-zinc-200 p-2 dark:border-zinc-700/70">
      {tree.files.map(path => (
        <ExportFileItem key={path} path={path} label={path} selected={path === selectedPath} onSelect={onSelect} />
      ))}
      {tree.folders.map(folder => (
        <ExportFileFolder key={folder.name} folder={folder} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </nav>
  );
};

export default ExportFileTree;
