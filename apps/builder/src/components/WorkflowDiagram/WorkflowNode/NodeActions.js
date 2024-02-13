// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';

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

NodeActions.propTypes = {
  className: PropTypes.string,
  onRemove: PropTypes.func
};

export default NodeActions;
