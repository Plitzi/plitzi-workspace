// Packages
import React from 'react';
import noop from 'lodash-es/noop';
import classNames from 'classnames';

/**
 * @param {{
 *   children: React.ReactNode;
 *   title?: string;
 *   className?: string;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const InputEasingButton = props => {
  const { children, title = '', className = '', onClick = noop } = props;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={classNames('m-1 h-6 w-6 rounded-sm p-1 hover:bg-gray-100', className)}
    >
      <svg viewBox="0 0 30 30" className="overflow-visible">
        {children}
      </svg>
    </button>
  );
};

export default InputEasingButton;
