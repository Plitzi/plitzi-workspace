import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import useInspectorValues from '../../hooks/useInspectorValues';
import InspectorSearchContext from '../../InspectorSearchContext';
import { advancedMatches } from '../../search';
import CategoryAdvancedContext from '../CategoryAdvanced/CategoryAdvancedContext';
import InspectorDots from '../InspectorDots';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode } from 'react';

export type CategoryContainerProps = {
  className?: string;
  classNameContent?: string;
  children?: ReactNode;
  title?: string;
  dotKeys?: StyleCategory[];
  advancedKeys?: StyleCategory[];
  isCollapsed?: boolean;
  onCollapse: (collapsed: boolean) => void;
};

const CategoryContainer = ({
  className,
  classNameContent,
  children,
  title = 'Title',
  dotKeys,
  advancedKeys,
  isCollapsed = true,
  onCollapse
}: CategoryContainerProps) => {
  const [showAdvanced, setShowAdvanced] = useStorage(`builder-state.styleInspector.advanced.${title}`, false);
  const { hasValues: hasAdvancedValues } = useInspectorValues({ keys: advancedKeys, asValue: false });
  const query = use(InspectorSearchContext);
  // A property searched for that lives behind the toggle is shown without touching the toggle: clearing the search
  // leaves the category as the person had it.
  const searchedAdvanced = advancedMatches(advancedKeys, query);
  const advancedVisible = showAdvanced || searchedAdvanced;

  const handleToggleAdvanced = useCallback(
    (e: MouseEvent) => {
      // The whole header toggles the category, so the button has to keep its click to itself.
      e.stopPropagation();
      setShowAdvanced(state => !state);
    },
    [setShowAdvanced]
  );

  return (
    <ContainerCollapsable className={className} collapsed={isCollapsed} onChange={onCollapse}>
      <ContainerCollapsable.Header
        className={clsx('h-8 px-2.5', {
          'border-b border-gray-200 dark:border-zinc-800': isCollapsed,
          'bg-gray-50 dark:bg-zinc-800/60': !isCollapsed
        })}
        title={<span className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{title}</span>}
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <div className="flex items-center gap-2">
          <InspectorDots styleKeys={dotKeys} />
          {!!advancedKeys?.length && !isCollapsed && (
            <Icon
              className={clsx('cursor-pointer text-xs', {
                'text-primary-500 dark:text-primary-400': advancedVisible,
                // A value living in a hidden row would be invisible otherwise, so the toggle carries the hint.
                'text-sky-600 dark:text-sky-400': !advancedVisible && hasAdvancedValues,
                'text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300':
                  !advancedVisible && !hasAdvancedValues
              })}
              icon="fa-solid fa-sliders"
              title={showAdvanced ? 'Hide advanced properties' : 'Show advanced properties'}
              onClick={handleToggleAdvanced}
            />
          )}
        </div>
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content
        className={clsx(
          'flex flex-col gap-3 px-2.5 py-3',
          { 'border-b border-gray-200 dark:border-zinc-800': !isCollapsed },
          classNameContent
        )}
      >
        <CategoryAdvancedContext value={advancedVisible}>{children}</CategoryAdvancedContext>
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default CategoryContainer;
