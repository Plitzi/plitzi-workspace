// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import noop from 'lodash/noop';

// Relatives
import DevToolsHeader from './DevToolsHeader';
import DevToolsBody from './DevToolsBody';

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
  const resizeHandles = useMemo(() => {
    if (orientation === ORIENTATION_VERTICAL) {
      return ['w'];
    }

    return ['n'];
  }, [orientation]);

  return (
    <ContainerResizable
      className={classNames('component__container-resizable-sidebar', className)}
      minConstraintsX={orientation === ORIENTATION_VERTICAL ? 400 : Infinity}
      maxConstraintsX={orientation === ORIENTATION_VERTICAL ? 1000 : Infinity}
      minConstraintsY={orientation === ORIENTATION_VERTICAL ? Infinity : 200}
      maxConstraintsY={orientation === ORIENTATION_VERTICAL ? Infinity : 500}
      width={orientation === ORIENTATION_VERTICAL ? 400 : Infinity}
      height={orientation === ORIENTATION_VERTICAL ? Infinity : 200}
      resizeHandles={resizeHandles}
      autoGrow={false}
    >
      <DevToolsHeader orientation={orientation} onChangeOrientation={onChangeOrientation} />
      <DevToolsBody orientation={orientation} />
    </ContainerResizable>
  );
};

export default DevToolsPanel;
