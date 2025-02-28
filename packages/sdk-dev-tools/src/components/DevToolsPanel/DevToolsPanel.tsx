import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import classNames from 'classnames';
import { useCallback, useMemo, useState, use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

import DevToolsBody from './DevToolsBody';
import DevToolsHeader from './DevToolsHeader';
import DevToolsSubHeader from './DevToolsSubHeader';

import type { Orientation } from '../../DevToolsContainer';
import type { ResizeHandle } from '@plitzi/plitzi-ui/ContainerResizable';
import type { ReactNode } from 'react';

export const ORIENTATION_VERTICAL = 'vertical';
export const ORIENTATION_HORIZONTAL = 'horizontal';

export type DevToolsPanelProps = {
  className?: string;
  children?: ReactNode;
  rootDOM?: object;
  orientation?: Orientation;
  onChangeOrientation?: (orientation: Orientation) => void;
};

const DevToolsPanel = ({ className, orientation = 'vertical', onChangeOrientation }: DevToolsPanelProps) => {
  const [tabSelected, setTabSelected] = useState('logs');
  const { currentPageId } = use(NavigationContext);
  const [elementSelected, setElementSelected] = useState<string | undefined>();
  const resizeHandles = useMemo<ResizeHandle[]>(() => (orientation === 'vertical' ? ['w'] : ['n']), [orientation]);
  const parentElement = useMemo<HTMLElement | undefined>(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    return document.getElementsByClassName('plitzi-sdk')[0] as HTMLElement | undefined;
  }, []);

  const handleTabSelect = useCallback((tabIndex: string) => setTabSelected(tabIndex), []);

  const handleSelectElement = useCallback((id?: string) => setElementSelected(id), [setElementSelected]);

  return (
    <ContainerResizable
      className={classNames('component__container-resizable-sidebar text-sm', className)}
      minConstraintsX={orientation === 'vertical' ? 500 : Infinity}
      maxConstraintsX={orientation === 'vertical' ? 1000 : Infinity}
      minConstraintsY={orientation === 'vertical' ? Infinity : 34}
      maxConstraintsY={orientation === 'vertical' ? Infinity : 600}
      width={orientation === 'vertical' ? 500 : Infinity}
      height={orientation === 'vertical' ? Infinity : 200}
      resizeHandles={resizeHandles}
      parentElement={parentElement}
      autoGrow={false}
    >
      <DevToolsHeader
        orientation={orientation}
        onChangeOrientation={onChangeOrientation}
        onTabSelect={handleTabSelect}
        tabSelected={tabSelected}
      />
      {['dataSources', 'elements'].includes(tabSelected) && (
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
    </ContainerResizable>
  );
};

export default DevToolsPanel;
