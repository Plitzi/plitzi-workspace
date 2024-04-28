// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';

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
    <div className={classNames('flex flex-col justify-around h-full', className)}>
      <Button
        intent="custom"
        size="custom"
        className="flex items-start flex items-center w-7 h-7 text-sm text-red-400 hover:text-red-500"
        onClick={handleClickRemove}
        title="Remove"
      >
        <i className="fas fa-trash-alt" />
      </Button>
    </div>
  );
};

export default NodeActions;
