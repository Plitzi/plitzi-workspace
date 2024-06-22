// Packages
import React from 'react';
import Button from '@plitzi/plitzi-ui-components/Button';
import noop from 'lodash/noop';

/**
 * @param {{}} props
 * @returns {React.ReactElement}
 */
const VariableSubValueActions = props => {
  const { fields, index, onClickRemove = noop, onClickUp = noop, onClickDown = noop } = props;

  return (
    <div className="flex flex-col gap-2">
      <Button
        intent="custom"
        size="custom"
        onClick={onClickRemove}
        title="Remove"
        className="text-red-400 hover:text-red-500 px-1 py-1"
      >
        <i className="fas fa-trash-alt" />
      </Button>
      {index > 0 && (
        <Button size="custom" className="rounded px-2 py-1 text-xs" title="Up" onClick={onClickUp}>
          <i className="fa-solid fa-arrow-up" />
        </Button>
      )}
      {index < fields.length - 1 && (
        <Button size="custom" className="rounded px-2 py-1 text-xs" title="Down" onClick={onClickDown}>
          <i className="fa-solid fa-arrow-down" />
        </Button>
      )}
    </div>
  );
};

export default VariableSubValueActions;
