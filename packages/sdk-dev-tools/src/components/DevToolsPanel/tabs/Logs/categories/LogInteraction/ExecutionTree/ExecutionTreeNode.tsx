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
      className={clsx('flex cursor-pointer items-center gap-1 px-2', {
        'pl-4': level === 1,
        'bg-gray-300': isSelected,
        'hover:bg-gray-200': !isSelected
      })}
      onClick={handleClick}
    >
      <div
        className={clsx('h-2.5 w-2.5 rounded-full', {
          'bg-green-500': status === 'success',
          'bg-orange-500': status === 'skipped',
          'bg-gray-500': status === 'disabled'
        })}
        title={status}
      />
      <div className="flex w-full justify-between">
        <div className="flex">
          {title} ({duration})
        </div>
        <div className="flex">[{action}]</div>
      </div>
    </div>
  );
};

export default ExecutionTreeNode;
