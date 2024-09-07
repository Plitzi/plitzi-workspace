// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   id: string;
 *   title: string;
 *   duration: string;
 *   level: number;
 *   isSelected?: boolean;
 *   status?: 'success' | 'disabled' | 'skipped';
 *   onClick: () => void;
 * }} props
 * @returns {React.ReactElement}
 */

const ExecutionTreeNode = props => {
  const { className, title, duration, status, level, id, isSelected, onClick = noop } = props;

  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  return (
    <div
      className={classNames('flex gap-1 items-center cursor-pointer', className, {
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
      {title} ({duration})
    </div>
  );
};

export default ExecutionTreeNode;
