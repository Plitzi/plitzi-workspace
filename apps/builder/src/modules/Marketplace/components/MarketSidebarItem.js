// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

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

MarketSidebarItem.propTypes = {
  id: PropTypes.string,
  children: PropTypes.node,
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
};

export default MarketSidebarItem;
