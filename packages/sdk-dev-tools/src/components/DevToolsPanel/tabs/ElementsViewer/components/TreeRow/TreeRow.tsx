import clsx from 'clsx';
import { useCallback } from 'react';

import type { TreeRow as Row } from '../../helpers/renderTree';

export type TreeRowProps = {
  row: Row;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onHover: (id?: string) => void;
};

/** One element of a tree, at its depth: its label, its type, the component it places, and whether it starts hidden. */
const TreeRow = ({ row, isSelected, onSelect, onHover }: TreeRowProps) => {
  const handleClick = useCallback(() => onSelect(row.id), [onSelect, row.id]);
  const handleMouseEnter = useCallback(() => onHover(row.id), [onHover, row.id]);
  const handleMouseLeave = useCallback(() => onHover(undefined), [onHover]);

  return (
    <div
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 border-l-2 py-1 pr-2 transition-colors',
        isSelected
          ? 'border-l-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
          : 'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
      )}
      style={{ paddingLeft: 8 + row.depth * 12 }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="truncate" title={row.id}>
        {row.label}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{row.type}</span>
      {row.instanceOf && (
        <span className="shrink-0 rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
          ◇ {row.instanceOf}
        </span>
      )}
      <span className="grow" />
      {row.hidden && (
        <i
          className="fa-solid fa-eye-slash shrink-0 text-[10px] text-zinc-300 dark:text-zinc-600"
          title="Starts hidden"
        />
      )}
    </div>
  );
};

export default TreeRow;
