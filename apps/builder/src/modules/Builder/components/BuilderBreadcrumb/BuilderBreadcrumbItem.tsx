import ContentEditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import get from 'lodash/get';
import { memo, use, useCallback, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ItemIcon from './ItemIcon';

export type BuilderBreadcrumbItemProps = {
  id?: string;
  label?: string;
  type?: string;
  isActive?: boolean;
  children?: React.ReactNode;
  className?: string;
  onMouseEnter?: (id: string) => void;
  onClick?: (id: string) => void;
};

const BuilderBreadcrumbItem = ({
  id = '',
  label = '',
  type = '',
  isActive = false,
  children,
  className = '',
  onMouseEnter,
  onClick
}: BuilderBreadcrumbItemProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const { updateElement } = use(BuilderContext);

  const handleMouseEnter = useCallback(() => onMouseEnter?.(id), [onMouseEnter, id]);

  const handleClick = useCallback(() => onClick?.(id), [onClick, id]);

  const handleChange = useCallback(
    (value: string) => updateElement(id, 'label', value, 'definition'),
    [updateElement, id]
  );

  const icon = useMemo(
    () => get(componentDefinitions, `${type}.market.icon`, '') as string,
    [type, componentDefinitions]
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
        <div className="flex items-center truncate cursor-pointer gap-0.5">
          <ItemIcon icon={icon} />
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
