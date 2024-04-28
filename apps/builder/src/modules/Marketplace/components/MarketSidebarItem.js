// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   id?: string;
 *   isSelected?: boolean;
 *   className?: string;
 *   children?: React.ReactNode;
 *   onClick?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const MarketSidebarItem = props => {
  const { id = '', isSelected = false, className = '', children, onClick = noop } = props;

  const handleClick = () => onClick(id);

  return (
    <li
      className={classNames('cursor-pointer select-none flex items-center justify-center py-2', className, {
        'font-bold text-blue-400': isSelected,
        'hover:text-blue-400': !isSelected
      })}
      onClick={handleClick}
    >
      {children}
    </li>
  );
};

export default MarketSidebarItem;
