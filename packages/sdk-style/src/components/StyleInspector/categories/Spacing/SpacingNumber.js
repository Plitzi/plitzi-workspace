// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   value?: string;
 *   active?: boolean;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SpacingNumber = props => {
  const { value = '', active = false, onClick = noop } = props;

  return (
    <div
      className={classNames('px-0.5 mx-0.5 border rounded-md text-xs w-[30px] flex items-center justify-center', {
        'hover:border-blue-300 hover:bg-blue-100 hover:text-blue-400 border-transparent': !active,
        'border-blue-300 bg-blue-100 text-blue-400': active
      })}
      title={value}
      onClick={onClick}
    >
      <div className="truncate">{value.replace('px', '')}</div>
    </div>
  );
};

export default SpacingNumber;
