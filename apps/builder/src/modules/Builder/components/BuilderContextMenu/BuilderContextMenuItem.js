// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

/**
 * @param {{
 *   title?: string;
 *   shortcut?: string;
 *   children?: React.ReactNode;
 *   className?: string;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderContextMenuItem = props => {
  const { title = 'Title', shortcut = '', children, className = '', onClick = noop, ...otherProps } = props;

  return (
    <div
      className={classNames(
        'flex items-center justify-between border-b border-gray-300 select-none py-1 px-4 hover:bg-blue-100 cursor-pointer last:border-b-0',
        className
      )}
      onClick={onClick}
      {...otherProps}
    >
      <div className="flex items-center">
        <div className="mr-1 text-blue-400">{children}</div>
        {title}
      </div>
      <div className="text-xs text-[10px] opacity-80 text-gray-500">{shortcut}</div>
    </div>
  );
};

export default BuilderContextMenuItem;
