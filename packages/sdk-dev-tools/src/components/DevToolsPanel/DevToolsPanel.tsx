import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, useMemo, useState, useRef } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import DevToolsBody from './DevToolsBody';
import DevToolsHeader from './DevToolsHeader';
import DevToolsSubHeader from './DevToolsSubHeader';

import type { Orientation } from '../../DevToolsContainer';
import type { ResizeHandle } from '@plitzi/plitzi-ui/ContainerResizable';
import type { LogType } from '@plitzi/sdk-shared';

export const ORIENTATION_VERTICAL = 'vertical';
export const ORIENTATION_HORIZONTAL = 'horizontal';

export type DevToolsPanelProps = {
  className?: string;
  orientation?: Orientation;
  tabSelected: string;
  /** Seeds the Logs filter when the panel is opened from the indicator, so a badge counting errors lands on them. */
  logTypeFilter?: LogType;
  onCollapse?: () => void;
  onTabSelect: (tabSelected: string) => void;
  onChangeOrientation?: (orientation: Orientation) => void;
};

const DevToolsPanel = ({
  className,
  orientation = 'vertical',
  tabSelected,
  logTypeFilter,
  onCollapse,
  onTabSelect,
  onChangeOrientation
}: DevToolsPanelProps) => {
  const [size, setSize] = useStorage('plitzi-sdk.dev-tools.size', { width: 500, height: 200 });
  const [currentPageId] = useCommonStore('navigation.currentPageId');
  const [elementSelected, setElementSelected] = useState<string | undefined>();
  const resizeHandles = useMemo<ResizeHandle[]>(() => (orientation === 'vertical' ? ['w'] : ['n']), [orientation]);
  const parentRef = useRef(
    typeof document !== 'undefined' ? (document.querySelector('.plitzi-sdk') as HTMLElement) : null
  );

  const handleSelectElement = useCallback((id?: string) => setElementSelected(id), [setElementSelected]);
  // Only one axis resizes per orientation (width when vertical, height when horizontal); the other arrives as Infinity.
  const handleResize = useCallback(
    (width: number, height: number) =>
      setSize(prev => ({
        width: Number.isFinite(width) ? width : prev.width,
        height: Number.isFinite(height) ? height : prev.height
      })),
    [setSize]
  );

  return (
    // Lifts the docked panel above the fixed "Made in Plitzi" badge (z-index 999999).
    <ContainerResizable
      className={clsx('component__container-resizable-sidebar relative z-[1000000] text-xs', className, {
        'h-full': orientation === 'vertical'
      })}
      minConstraintsX={orientation === 'vertical' ? 500 : Infinity}
      maxConstraintsX={orientation === 'vertical' ? 1000 : Infinity}
      minConstraintsY={orientation === 'vertical' ? Infinity : 34}
      maxConstraintsY={orientation === 'vertical' ? Infinity : 600}
      width={orientation === 'vertical' ? size.width : Infinity}
      height={orientation === 'vertical' ? Infinity : size.height}
      resizeHandles={resizeHandles}
      parentRef={parentRef}
      autoGrow={false}
      onChange={handleResize}
    >
      <div className="flex h-full w-full flex-col bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <DevToolsHeader
          orientation={orientation}
          onChangeOrientation={onChangeOrientation}
          onCollapse={onCollapse}
          onTabSelect={onTabSelect}
          tabSelected={tabSelected}
        />
        {['store', 'elements'].includes(tabSelected) && (
          <DevToolsSubHeader
            elementSelected={elementSelected}
            onSelectElement={handleSelectElement}
            currentPageId={currentPageId}
          />
        )}
        <DevToolsBody
          orientation={orientation}
          tabSelected={tabSelected}
          logTypeFilter={logTypeFilter}
          elementSelected={elementSelected}
          onSelectElement={handleSelectElement}
        />
      </div>
    </ContainerResizable>
  );
};

export default DevToolsPanel;
