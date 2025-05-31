import ContentEditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import { memo, use, useCallback } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

export type BuilderBreadcrumbItemProps = {
  id?: string;
  label?: string;
  isActive?: boolean;
  children?: React.ReactNode;
  className?: string;
  onMouseEnter?: (id: string) => void;
  onClick?: (id: string) => void;
};

const BuilderBreadcrumbItem = ({
  id = '',
  label = '',
  isActive = false,
  children,
  className = '',
  onMouseEnter,
  onClick
}: BuilderBreadcrumbItemProps) => {
  const { updateElement } = use(BuilderContext);

  const handleMouseEnter = useCallback(() => onMouseEnter?.(id), [onMouseEnter, id]);

  const handleClick = useCallback(() => onClick?.(id), [onClick, id]);

  const handleChange = useCallback(
    (value: string) => updateElement(id, 'label', value, 'definition'),
    [updateElement, id]
  );

  return (
    <li
      className={classNames(
        'breadcrumb__item flex not-first:before:content-[">"] first:before:content-none before:text-black gap-2 text-xs select-none items-center',
        className,
        { 'hover:text-primary-500': !isActive, 'text-primary-500': isActive }
      )}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      tabIndex={-1}
    >
      {label && (
        <div className="truncate cursor-pointer">
          <ContentEditable
            className="focus-visible:px-1 focus-visible:m-[1px] focus-visible:outline-dashed focus-visible:outline-1"
            value={label}
            onChange={handleChange}
            openMode="doubleClick"
          />
        </div>
      )}
      {!label && <div className="cursor-pointer">{children}</div>}
    </li>
  );
};

export default memo(BuilderBreadcrumbItem);
