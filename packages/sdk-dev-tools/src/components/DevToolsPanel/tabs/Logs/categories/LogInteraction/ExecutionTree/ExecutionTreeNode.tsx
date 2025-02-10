// Packages
import classNames from 'classnames';
import { useCallback } from 'react';

// Types
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
      className={classNames('flex gap-1 items-center cursor-pointer px-2', {
        'pl-4': level === 1,
        'bg-gray-300': isSelected,
        'hover:bg-gray-200': !isSelected
      })}
      onClick={handleClick}
    >
      <div
        className={classNames('w-2.5 h-2.5 rounded-full', {
          'bg-green-500': status === 'success',
          'bg-orange-500': status === 'skipped',
          'bg-gray-500': status === 'disabled'
        })}
        title={status}
      />
      <div className="flex justify-between w-full">
        <div className="flex">
          {title} ({duration})
        </div>
        <div className="flex">[{action}]</div>
      </div>
    </div>
  );
};

export default ExecutionTreeNode;
