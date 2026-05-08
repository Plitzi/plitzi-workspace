import clsx from 'clsx';

export type ConfirmPanelProps = {
  confirming: boolean;
  target: 'page' | 'element';
  elementSelected?: string;
  onStartConfirm: () => void;
  onCancel: () => void;
  onTargetPage: () => void;
  onTargetElement: () => void;
  onConfirm: () => void;
};

const ConfirmPanel = ({
  confirming,
  target,
  elementSelected,
  onStartConfirm,
  onCancel,
  onTargetPage,
  onTargetElement,
  onConfirm
}: ConfirmPanelProps) => {
  if (confirming) {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
        <p className="mb-1.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">Apply layout to:</p>
        <div className="mb-2 flex gap-1">
          <button
            onClick={onTargetPage}
            className={clsx('rounded border px-2 py-0.5 font-mono text-[10px]', {
              'border-zinc-400 bg-zinc-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200':
                target === 'page',
              'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400':
                target !== 'page'
            })}
          >
            Current Page
          </button>
          {elementSelected && (
            <button
              onClick={onTargetElement}
              className={clsx('rounded border px-2 py-0.5 font-mono text-[10px]', {
                'border-zinc-400 bg-zinc-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200':
                  target === 'element',
                'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400':
                  target !== 'element'
              })}
            >
              Selected Element
            </button>
          )}
        </div>
        {target === 'element' && elementSelected && (
          <p className="mb-1.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
            Will be added as children of <span className="text-orange-500">"{elementSelected}"</span>
          </p>
        )}
        <p className="mb-2 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
          The AI will commit this proposed element permanently.
        </p>
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
    <div className="flex items-center justify-end border-t border-zinc-100 bg-zinc-50 px-3 py-1 dark:border-zinc-700/60 dark:bg-zinc-900/60">
      <button
        onClick={onStartConfirm}
        className="rounded border border-zinc-300 px-2.5 py-1 font-mono text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Apply to Page
      </button>
    </div>
  );
};

export default ConfirmPanel;
