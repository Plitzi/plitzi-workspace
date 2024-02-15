// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

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

InspectorButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isActive: PropTypes.bool,
  intent: PropTypes.oneOf(['primary', 'danger', 'warning', 'success']),
  onClick: PropTypes.func
};

export default InspectorButton;
