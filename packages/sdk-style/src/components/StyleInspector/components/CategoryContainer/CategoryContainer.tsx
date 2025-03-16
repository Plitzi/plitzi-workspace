import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';

import InspectorDots from '../InspectorDots';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryContainerProps = {
  children?: ReactNode;
  title?: string;
  dotKeys: StyleCategory[];
  isCollapsed?: boolean;
  onCollapse: (collapsed: boolean) => void;
};

const CategoryContainer = ({
  children,
  title = 'Title',
  dotKeys,
  isCollapsed = true,
  onCollapse
}: CategoryContainerProps) => {
  return (
    <ContainerCollapsable collapsed={isCollapsed} onChange={onCollapse}>
      <ContainerCollapsable.Header
        className="h-7"
        title={title}
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <InspectorDots styleKeys={dotKeys} />
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content className="flex flex-col gap-2 py-2">{children}</ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default CategoryContainer;
