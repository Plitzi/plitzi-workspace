// Packages
import React, { useCallback, use } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';

// Relatives
import WorkflowContext from '../WorkflowContext';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   canUp?: boolean;
 *   canDown?: boolean;
 *   onClickOpen?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeFooter = props => {
  const { className = '', id = '', canUp = false, canDown = false, onClickOpen = noop } = props;

  const { moveNode } = use(WorkflowContext);

  const handleClickUp = useCallback(() => moveNode(id, 'up'), [id, moveNode]);

  const handleClickDown = useCallback(() => moveNode(id, 'down'), [id, moveNode]);

  return (
    <div
      className={classNames('flex p-2 items-center border-t-2 border-gray-300 border-dotted cursor-pointer', className)}
    >
      <div className="flex items-center basis-0 grow mr-2" />
      <div className="flex items-center justify-center basis-0 grow" onClick={onClickOpen}>
        <i className="fa-solid fa-arrows-up-to-line mr-2" />
        <div>Close</div>
      </div>
      <div className="flex ml-2 basis-0 gap-2 grow justify-end">
        {canUp && (
          <Button size="custom" className="rounded px-2 py-1 text-xs" title="Up" onClick={handleClickUp}>
            <i className="fa-solid fa-arrow-up" />
          </Button>
        )}
        {canDown && (
          <Button size="custom" className="rounded px-2 py-1 text-xs" title="Down" onClick={handleClickDown}>
            <i className="fa-solid fa-arrow-down" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeFooter;
