import Input from '@plitzi/plitzi-ui/Input';

export type HistoryToolbarProps = {
  index: number;
  total: number;
  canUndo: boolean;
  canRedo: boolean;
  filter: string;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onFilterChange: (value: string) => void;
};

const HistoryToolbar = ({
  index,
  total,
  canUndo,
  canRedo,
  filter,
  onUndo,
  onRedo,
  onClear,
  onFilterChange
}: HistoryToolbarProps) => (
  <div className="flex shrink-0 flex-col gap-1.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex items-center gap-1">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 enabled:hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-300 dark:enabled:hover:bg-zinc-700"
      >
        <i className="fa-solid fa-rotate-left" />
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 enabled:hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-300 dark:enabled:hover:bg-zinc-700"
      >
        <i className="fa-solid fa-rotate-right" />
        Redo
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {index + 1} / {total}
        </span>
        <button
          onClick={onClear}
          className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i className="fa-solid fa-trash" />
          Clear
        </button>
      </div>
    </div>
    <Input value={filter} onChange={onFilterChange} placeholder="Filter by path..." size="sm" />
  </div>
);

export default HistoryToolbar;
