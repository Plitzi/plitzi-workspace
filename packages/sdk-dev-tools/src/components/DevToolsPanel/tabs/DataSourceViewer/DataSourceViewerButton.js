// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   className?: string;
 *   isSelected?: boolean;
 *   iconClassName?: string;
 *   title?: string;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceViewerButton = props => {
  const { className, iconClassName, title, isSelected = false, onClick = noop } = props;

  return (
    <i
      className={classNames(
        'w-6 h-6 flex items-center justify-center border border-dotted p-0.5 cursor-pointer',
        {
          'border-gray-500 hover:text-purple-500 hover:border-purple-500': !isSelected,
          'text-purple-500 border-purple-500': isSelected
        },
        className,
        iconClassName
      )}
      title={title}
      onClick={onClick}
    />
  );
};

export default DataSourceViewerButton;
