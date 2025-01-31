// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   active?: boolean;
 *   name?: string;
 *   onClick?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const FilterCategory = props => {
  const { className = '', id = '', active = false, name = 'Category', onClick = noop } = props;

  const handleClick = () => onClick(id);

  return (
    <div
      className={classNames(
        'flex px-2 py-1.5 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-gray-300 grow basis-0 items-center justify-center cursor-pointer',
        className,
        { 'bg-blue-100 font-bold': active }
      )}
      onClick={handleClick}
    >
      {name}
    </div>
  );
};

export default FilterCategory;
