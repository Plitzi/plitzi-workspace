// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const TreeNodeActionButton = props => {
  const {
    className = '',
    children,
    title = 'Title',
    theme = 'normal',
    isRemoving = false,
    isVisible = true,
    ...otherProps
  } = props;

  return (
    <button
      type="button"
      className={classNames(
        'px-1 items-center justify-center cursor-pointer',
        {
          flex: isVisible,
          hidden: !isVisible,
          'text-blue-400 hover:text-blue-300': theme === 'normal' && !isRemoving,
          'text-red-400 hover:text-red-300': isRemoving
        },
        className
      )}
      title={title}
      {...otherProps}
    >
      {children}
    </button>
  );
};

TreeNodeActionButton.propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
  children: PropTypes.node,
  theme: PropTypes.oneOf(['normal']),
  isRemoving: PropTypes.bool,
  isVisible: PropTypes.bool
};

export default TreeNodeActionButton;
