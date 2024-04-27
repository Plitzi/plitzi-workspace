// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   title?: string;
 *   active?: boolean;
 *   children?: React.ReactNode;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const GroupButton = props => {
  const { className = '', title = '', active = false, children, onClick = noop } = props;

  return (
    <div
      className={classNames(
        'flex items-center justify-center grow basis-0 px-1 cursor-pointer',
        { 'text-blue-400': active },
        className
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </div>
  );
};

export default GroupButton;
