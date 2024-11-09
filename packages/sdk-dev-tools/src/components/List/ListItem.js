// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop.js';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   name?: string;
 *   isSelected?: boolean;
 *   onSelect?: (string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ListItem = props => {
  const { name, id, isSelected, className, onSelect = noop } = props;

  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);

  return (
    <div
      className={classNames(
        'flex w-full cursor-pointer border border-gray-300 rounded px-2 py-1 gap-4 justify-between items-center',
        { 'bg-purple-300': isSelected, 'hover:bg-purple-200': !isSelected },
        className
      )}
      onClick={handleClick}
    >
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ListItem;
