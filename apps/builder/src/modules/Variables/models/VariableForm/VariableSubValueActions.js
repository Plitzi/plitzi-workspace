// Packages
import React from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import noop from 'lodash/noop';

/**
 * @param {{
 *   indexLimit?: number;
 *   index?: number;
 *   onClickRemove?: () => void;
 *   onClickUp?: () => void;
 *   onClickDown?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableSubValueActions = props => {
  const { indexLimit = 0, index = 0, onClickRemove = noop, onClickUp = noop, onClickDown = noop } = props;

  return (
    <div className="flex gap-2">
      <Button
        intent="danger"
        size="xs"
        onClick={onClickRemove}
        title="Remove"
        className="aspect-square"
      >
        <i className="fas fa-trash-alt" />
      </Button>
      {index > 0 && (
        <Button size="xs" className="aspect-square" title="Up" onClick={onClickUp}>
          <i className="fa-solid fa-arrow-up" />
        </Button>
      )}
      {index < indexLimit && (
        <Button size="xs" className="aspect-square" title="Down" onClick={onClickDown}>
          <i className="fa-solid fa-arrow-down" />
        </Button>
      )}
    </div>
  );
};

export default VariableSubValueActions;
