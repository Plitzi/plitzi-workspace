// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui/Button';

/**
 * @param {{
 *   className?: string;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeActions = props => {
  const { className = '', onRemove = noop } = props;

  const handleClickRemove = useCallback(() => onRemove(), [onRemove]);

  return (
    <div className={classNames('flex h-full flex-col justify-around', className)}>
      <Button
        intent="custom"
        size="custom"
        className="flex h-7 w-7 items-center text-sm text-red-400 hover:text-red-500"
        onClick={handleClickRemove}
        title="Remove"
      >
        <i className="fas fa-trash-alt" />
      </Button>
    </div>
  );
};

export default NodeActions;
