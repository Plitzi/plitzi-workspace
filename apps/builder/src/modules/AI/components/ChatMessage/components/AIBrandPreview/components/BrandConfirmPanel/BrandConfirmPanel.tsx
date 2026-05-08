export type BrandCssVar = {
  varName: string;
  value: string;
  preview: string | undefined;
};

export type BrandConfirmPanelProps = {
  confirming: boolean;
  cssVars: BrandCssVar[];
  onStartConfirm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const BrandConfirmPanel = ({ confirming, cssVars, onStartConfirm, onCancel, onConfirm }: BrandConfirmPanelProps) => {
  if (confirming) {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
        <p className="mb-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          Create {cssVars.length} style variable{cssVars.length !== 1 ? 's' : ''}:
        </p>
        <div className="mb-2 max-h-28 space-y-0.5 overflow-y-auto">
          {cssVars.map(({ varName, value, preview }) => (
            <div key={varName} className="flex items-center gap-2">
              {preview && (
                <div
                  className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: preview }}
                />
              )}
              {!preview && (
                <span className="h-3 w-3 shrink-0 text-center font-mono text-[8px] leading-3 text-zinc-400">Aa</span>
              )}
              <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300">{varName}</span>
              <span className="ml-auto truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Confirm & Apply
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-1 dark:border-zinc-700/60 dark:bg-zinc-900/60">
      <button
        onClick={onStartConfirm}
        className="rounded border border-zinc-300 px-2.5 py-1 font-mono text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Apply to Space
      </button>
      <button
        disabled
        title="Coming soon"
        className="cursor-not-allowed rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
      >
        Save Brand
      </button>
    </div>
  );
};

export default BrandConfirmPanel;
