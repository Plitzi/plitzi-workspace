import clsx from 'clsx';
import { useCallback } from 'react';

import { useDevToolsTheme } from '../../../../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();
  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  const dotColor =
    status === 'success'
      ? 'bg-emerald-500'
      : status === 'skipped'
        ? 'bg-amber-500'
        : status === 'disabled'
          ? isDark
            ? 'bg-zinc-600'
            : 'bg-zinc-300'
          : isDark
            ? 'bg-zinc-500'
            : 'bg-zinc-400';

  return (
    <div
      className={clsx(
        'flex cursor-pointer items-center gap-2 border-l-2 px-2 py-1 transition-colors',
        level === 1 ? 'pl-5' : 'pl-2',
        isSelected
          ? isDark
            ? 'border-l-violet-500 bg-violet-500/15 text-violet-300'
            : 'border-l-violet-500 bg-violet-50 text-violet-700'
          : isDark
            ? 'border-l-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            : 'border-l-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
      )}
      onClick={handleClick}
    >
      <div className={clsx('h-2 w-2 shrink-0 rounded-full', dotColor)} title={status} />
      <div className="flex min-w-0 grow justify-between gap-2">
        <span className="truncate">{title}</span>
        <div className={clsx('flex shrink-0 items-center gap-1.5', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
          <span className="font-mono">{duration}</span>
          {action && (
            <span
              className={clsx(
                'rounded px-1 font-mono text-[10px]',
                isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-500'
              )}
            >
              {action}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionTreeNode;
