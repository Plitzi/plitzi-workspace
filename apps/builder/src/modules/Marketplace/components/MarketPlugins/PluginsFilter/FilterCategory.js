// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';

const FilterCategory = props => {
  const { className = '', id = '', active = false, name = 'Category', onClick = noop } = props;

  const handleClick = () => onClick(id);

  return (
    <div
      className={classNames(
        'flex px-2 py-1.5 not-last:border-r not-last:border-gray-300 grow basis-0 items-center justify-center cursor-pointer',
        className,
        { 'bg-blue-100 font-bold': active }
      )}
      onClick={handleClick}
    >
      {name}
    </div>
  );
};

FilterCategory.propTypes = {
  className: PropTypes.string,
  active: PropTypes.bool,
  id: PropTypes.string,
  name: PropTypes.string,
  onClick: PropTypes.func
};

export default FilterCategory;
