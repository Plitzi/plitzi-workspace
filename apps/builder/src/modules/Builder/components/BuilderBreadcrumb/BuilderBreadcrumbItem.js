// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

const BuilderBreadcrumbItem = props => {
  const { id, label = '', isActive = false, children, className = '', onMouseEnter = noop, onClick = noop } = props;

  const handleMouseEnter = () => onMouseEnter(id);

  const handleClick = () => onClick(id);

  return (
    <div
      className={classNames(
        'breadcrumb__item flex before:border-gray-300 font-bold basis-0 cursor-pointer relative items-center select-none pl-4 first:pl-1.5 min-h-[24px] no-underline',
        className,
        {
          'after:border-l-white': !isActive,
          'bg-blue-400 text-white after:border-l-blue-400': isActive
        }
      )}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      tabIndex={-1}
    >
      {label && <div className="truncate">{label}</div>}
      {!label && children}
    </div>
  );
};

BuilderBreadcrumbItem.propTypes = {
  id: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  label: PropTypes.string,
  isActive: PropTypes.bool,
  onMouseEnter: PropTypes.func,
  onClick: PropTypes.func
};

export default BuilderBreadcrumbItem;
