// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   id?: string;
 *   label?: string;
 *   isActive?: boolean;
 *   children?: React.ReactNode;
 *   className?: string;
 *   onMouseEnter?: (id: string) => void;
 *   onClick?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default BuilderBreadcrumbItem;
