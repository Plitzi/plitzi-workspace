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
          'text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg border-l-transparent dark:border-l-transparent':
            !isSelected
        }
      )}
      onClick={handleClick}
    >
      <div
        className={clsx('h-2 w-2 shrink-0 rounded-full', {
          'bg-emerald-500': status === 'success',
          'bg-amber-500': status === 'skipped',
          'bg-ui-line-strong': status === 'disabled',
          'bg-ui-fg-subtle': status === 'failed'
        })}
        title={status}
      />
      <div className="flex min-w-0 grow justify-between gap-2">
        <span className="truncate">{title}</span>
        <div className="text-ui-fg-subtle flex shrink-0 items-center gap-1.5">
          <span className="font-mono">{duration}</span>
          {action && (
            <span className="bg-ui-raised text-ui-fg-subtle rounded px-1 font-mono text-[10px]">{action}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionTreeNode;
