// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';

const InputEasingButton = props => {
  const { children, title = '', className = '', onClick = noop } = props;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={classNames('h-6 w-6 m-1 p-1 rounded hover:bg-gray-100', className)}
    >
      <svg viewBox="0 0 30 30" className="overflow-visible">
        {children}
      </svg>
    </button>
  );
};

InputEasingButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  title: PropTypes.string,
  onClick: PropTypes.func
};

export default InputEasingButton;
