// Packages
import React from 'react';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 *   title?: string;
 *   theme?: 'normal';
 *   isRemoving?: boolean;
 *   isVisible?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default TreeNodeActionButton;
