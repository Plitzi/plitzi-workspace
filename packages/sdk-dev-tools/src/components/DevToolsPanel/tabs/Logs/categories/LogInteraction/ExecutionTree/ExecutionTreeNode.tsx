import clsx from 'clsx';
import { useCallback } from 'react';

import type { InteractionNodeStatus } from '@plitzi/sdk-shared';

export type ExecutionTreeNodeProps = {
  id: string;
  action?: string;
  title: string;
  duration: string;
  level: number;
  isSelected?: boolean;
  status?: InteractionNodeStatus;
  onClick: (id: string) => void;
};

const ExecutionTreeNode = ({
  title,
  action,
  duration,
  status,
  level,
  id,
  isSelected,
  onClick
}: ExecutionTreeNodeProps) => {
  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  return (
    <div
      className={clsx(
        'flex cursor-pointer items-center gap-2 border-l-2 px-2 py-1 transition-colors',
        level === 1 ? 'pl-5' : 'pl-2',
        {
          'border-l-violet-500 bg-violet-50 text-violet-700 dark:border-l-violet-500 dark:bg-violet-500/15 dark:text-violet-300':
            isSelected,
          'border-l-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-l-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200':
            !isSelected
        }
      )}
      onClick={handleClick}
    >
      <div
        className={clsx('h-2 w-2 shrink-0 rounded-full', {
          'bg-emerald-500': status === 'success',
          'bg-amber-500': status === 'skipped',
          'bg-zinc-300 dark:bg-zinc-600': status === 'disabled',
          'bg-zinc-400 dark:bg-zinc-500': status === 'failed'
        })}
        title={status}
      />
      <div className="flex min-w-0 grow justify-between gap-2">
        <span className="truncate">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5 text-zinc-400 dark:text-zinc-600">
          <span className="font-mono">{duration}</span>
          {action && (
            <span className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
              {action}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionTreeNode;
