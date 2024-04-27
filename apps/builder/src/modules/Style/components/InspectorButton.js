// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 *   intent?: 'primary' | 'danger' | 'warning' | 'success';
 *   isActive?: boolean;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorButton = props => {
  const { children, intent = 'primary', className = '', isActive = false, onClick = noop, ...otherProps } = props;

  return (
    <button
      {...otherProps}
      type="button"
      className={classNames('flex items-center justify-center hover:text-blue-400', className, {
        'text-blue-400': isActive,
        'hover:text-blue-400': intent === 'primary',
        'hover:text-red-400': intent === 'danger',
        'hover:text-orange-400': intent === 'warning',
        'hover:text-green-400': intent === 'success'
      })}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default InspectorButton;
