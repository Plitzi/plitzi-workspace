import ContentEditable from '@plitzi/plitzi-ui/ContentEditable';
import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
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
    () => get(componentDefinitions.current, `${type}.market.icon`, ''),
    [type, componentDefinitions]
  );

  return (
    <li
      className={clsx(
        'breadcrumb__item flex items-center gap-2 text-xs select-none before:text-black not-first:before:content-[">"] first:before:content-none dark:before:text-zinc-500',
        className,
        { 'hover:text-primary-500': !isActive, 'text-primary-500': isActive }
      )}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      tabIndex={-1}
    >
      {label && (
        <div className="flex cursor-pointer items-center gap-0.5 truncate">
          <ItemIcon icon={icon} />
          <ContentEditable
            className="focus-visible:m-px focus-visible:px-1 focus-visible:outline-1 focus-visible:outline-dashed"
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
