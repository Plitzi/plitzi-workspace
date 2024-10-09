// Packages
import React, { useCallback, useMemo, useState, use } from 'react';
import classNames from 'classnames';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import noop from 'lodash/noop';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import DevToolsHeader from './DevToolsHeader';
import DevToolsBody from './DevToolsBody';
import DevToolsSubHeader from './DevToolsSubHeader';

export const ORIENTATION_VERTICAL = 'vertical';
export const ORIENTATION_HORIZONTAL = 'horizontal';

/**
 * @param {{
 *   className?: string;
 *   children: React.ReactNode;
 *   rootDOM: object;
 *   orientation: 'horizontal' | 'vertical';
 *   onChangeOrientation: (orientation: 'horizontal' | 'vertical') => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsPanel = props => {
  const { className, orientation = ORIENTATION_VERTICAL, onChangeOrientation = noop } = props;
  const [tabSelected, setTabSelected] = useState('elements');
  const { currentPageId } = use(NavigationContext);
  const [elementSelected, setElementSelected] = useState(currentPageId);
  const resizeHandles = useMemo(() => (orientation === ORIENTATION_VERTICAL ? ['w'] : ['n']), [orientation]);
  const parentElement = useMemo(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    return document.getElementsByClassName('plitzi-sdk')?.[0];
  }, []);

  const handleTabSelect = useCallback(tabIndex => setTabSelected(tabIndex), []);

  const handleSelectElement = useCallback(id => setElementSelected(id), [setElementSelected]);

  return (
    <ContainerResizable
      className={classNames('component__container-resizable-sidebar text-sm', className)}
      minConstraintsX={orientation === ORIENTATION_VERTICAL ? 500 : Infinity}
      maxConstraintsX={orientation === ORIENTATION_VERTICAL ? 1000 : Infinity}
      minConstraintsY={orientation === ORIENTATION_VERTICAL ? Infinity : 34}
      maxConstraintsY={orientation === ORIENTATION_VERTICAL ? Infinity : 600}
      width={orientation === ORIENTATION_VERTICAL ? 500 : Infinity}
      height={orientation === ORIENTATION_VERTICAL ? Infinity : 350}
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
