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
  <div className="border-ui-line bg-ui-panel flex shrink-0 flex-col gap-1.5 border-b px-2 py-1.5">
    <div className="flex items-center gap-1">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="text-ui-fg-muted enabled:hover:bg-ui-hover flex h-6 items-center gap-1 rounded px-2 text-xs font-medium disabled:opacity-40"
      >
        <i className="fa-solid fa-rotate-left" />
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="text-ui-fg-muted enabled:hover:bg-ui-hover flex h-6 items-center gap-1 rounded px-2 text-xs font-medium disabled:opacity-40"
      >
        <i className="fa-solid fa-rotate-right" />
        Redo
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-ui-fg-subtle text-[10px]">
          {index + 1} / {total}
        </span>
        <button
          onClick={onClear}
          className="text-ui-fg-muted hover:bg-ui-hover flex h-6 items-center gap-1 rounded px-2 text-xs font-medium"
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
