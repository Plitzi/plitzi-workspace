// Packages
import React, { use, useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import ContentEditable from '@plitzi/plitzi-ui-components/ContentEditable';

// Alias
import BuilderContext from '@pmodules/Builder/BuilderContext';

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
  const { updateElement } = use(BuilderContext);

  const handleMouseEnter = useCallback(() => onMouseEnter(id), [onMouseEnter, id]);

  const handleClick = useCallback(() => onClick(id), [onClick, id]);

  const handleChange = useCallback(value => updateElement(id, 'label', value, 'definition'), [updateElement, id]);

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
      {label && (
        <div className="truncate">
          <ContentEditable
            className="focus-visible:px-1 focus-visible:m-[1px] focus-visible:outline-dashed focus-visible:outline-1"
            value={label}
            onChange={handleChange}
            openMode="doubleClick"
          />
        </div>
      )}
      {!label && children}
    </div>
  );
};

export default BuilderBreadcrumbItem;
