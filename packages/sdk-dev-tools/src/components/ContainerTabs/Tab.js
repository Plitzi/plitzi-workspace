// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   index?: number;
 *   label?: object;
 *   tabSelected?: boolean;
 *   onSelect?: (index: number) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Tab = props => {
  const { className, label = 'Tab Name', tabSelected = false, index = 0, onSelect = noop } = props;

  const handleClick = useCallback(() => onSelect(index), [index, onSelect]);

  return (
    <div
      className={classNames(
        'flex items-center justify-center rounded grow cursor-pointer',
        { 'bg-white': tabSelected, 'text-gray-500': !tabSelected },
        className
      )}
      onClick={handleClick}
    >
      {label}
    </div>
  );
};

export default Tab;
