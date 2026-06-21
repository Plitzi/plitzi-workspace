import Leaf from './Leaf';
import { type LeafPath, type TreeRow, TREE_ROWS } from '../stateTreeStore';

export type TreeViewProps = {
  watched: LeafPath;
  onWatch: (path: LeafPath) => void;
};

const Branch = ({ row }: { row: TreeRow }) => (
  <div
    style={{ paddingLeft: `${0.625 + row.depth * 1.15}rem` }}
    className="relative flex items-center gap-2 py-1.5 pr-2.5 font-mono text-xs text-zinc-500"
  >
    <span className="bg-brand-500/40 h-2 w-2 shrink-0 rounded-sm" />
    <span className="text-zinc-300">{row.label}</span>
    <span className="text-zinc-600">{'{ }'}</span>
  </div>
);

const TreeRowItem = ({ row, watched, onWatch }: { row: TreeRow } & TreeViewProps) => {
  if (!row.leaf || !row.path) {
    return <Branch row={row} />;
  }

  return <Leaf path={row.path} label={row.label} depth={row.depth} watched={watched === row.path} onWatch={onWatch} />;
};

const TreeView = ({ watched, onWatch }: TreeViewProps) => (
  <div className="relative flex flex-col gap-0.5">
    <span className="bg-ink-700 absolute top-2 bottom-2 left-1 w-px" aria-hidden />
    {TREE_ROWS.map(row => (
      <TreeRowItem key={row.path ?? row.label} row={row} watched={watched} onWatch={onWatch} />
    ))}
  </div>
);

export default TreeView;
