import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';

import InspectorDots from '../InspectorDots';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryContainerProps = {
  className?: string;
  classNameContent?: string;
  children?: ReactNode;
  title?: string;
  dotKeys?: StyleCategory[];
  isCollapsed?: boolean;
  onCollapse: (collapsed: boolean) => void;
};

const CategoryContainer = ({
  className,
  classNameContent,
  children,
  title = 'Title',
  dotKeys,
  isCollapsed = true,
  onCollapse
}: CategoryContainerProps) => {
  return (
    <ContainerCollapsable className={className} collapsed={isCollapsed} onChange={onCollapse}>
      <ContainerCollapsable.Header
        className={clsx('h-8', {
          'border-b border-gray-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700/50': isCollapsed,
          'bg-slate-100 dark:bg-zinc-700/50': !isCollapsed
        })}
        title={title}
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <InspectorDots styleKeys={dotKeys} />
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content
        className={clsx('flex flex-col gap-3 p-2', { 'border-b border-gray-200 dark:border-zinc-700': !isCollapsed }, classNameContent)}
      >
        {children}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default CategoryContainer;
