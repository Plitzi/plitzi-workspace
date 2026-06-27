import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, useMemo, useState, use, useRef } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

import DevToolsBody from './DevToolsBody';
import DevToolsHeader from './DevToolsHeader';
import DevToolsSubHeader from './DevToolsSubHeader';

import type { Orientation } from '../../DevToolsContainer';
import type { ResizeHandle } from '@plitzi/plitzi-ui/ContainerResizable';

export const ORIENTATION_VERTICAL = 'vertical';
export const ORIENTATION_HORIZONTAL = 'horizontal';

export type DevToolsPanelProps = {
  className?: string;
  orientation?: Orientation;
  onChangeOrientation?: (orientation: Orientation) => void;
};

const DevToolsPanel = ({ className, orientation = 'vertical', onChangeOrientation }: DevToolsPanelProps) => {
  const [tabSelected, setTabSelected] = useStorage('plitzi-sdk.dev-tools.tab', 'logs');
  const [size, setSize] = useStorage('plitzi-sdk.dev-tools.size', { width: 500, height: 200 });
  const { currentPageId } = use(NavigationContext);
  const [elementSelected, setElementSelected] = useState<string | undefined>();
  const resizeHandles = useMemo<ResizeHandle[]>(() => (orientation === 'vertical' ? ['w'] : ['n']), [orientation]);
  const parentRef = useRef(
    typeof document !== 'undefined' ? (document.querySelector('.plitzi-sdk') as HTMLElement) : null
  );

  const handleTabSelect = useCallback((tabIndex: string) => setTabSelected(tabIndex), [setTabSelected]);
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
    <ContainerResizable
      className={clsx('component__container-resizable-sidebar text-xs', className, {
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
          onTabSelect={handleTabSelect}
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
          elementSelected={elementSelected}
          onSelectElement={handleSelectElement}
        />
      </div>
    </ContainerResizable>
  );
};

export default DevToolsPanel;
