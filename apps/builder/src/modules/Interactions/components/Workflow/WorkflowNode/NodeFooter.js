// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   onClickOpen?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeFooter = props => {
  const { className = '', onClickOpen = noop } = props;

  return (
    <div
      className={classNames('flex p-2 items-center border-t-2 border-gray-300 border-dotted cursor-pointer', className)}
    >
      <div className="flex items-center basis-0 grow mr-2" />
      <div className="flex items-center justify-center basis-0 grow" onClick={onClickOpen}>
        <i className="fa-solid fa-arrows-up-to-line mr-2" />
        <div>Close</div>
      </div>
    </div>
  );
};

export default NodeFooter;
