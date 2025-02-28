import classNames from 'classnames';
import { useState, useCallback } from 'react';

import DevToolsPanel from './components/DevToolsPanel';
import DevToolsContextProvider from './DevToolsContextProvider';

import type { ReactNode } from 'react';

export type Orientation = 'horizontal' | 'vertical';

export type DevToolsContainerProps = {
  children?: ReactNode;
  enabled?: boolean;
};

const DevToolsContainer = ({ children, enabled = false }: DevToolsContainerProps) => {
  const [orientation, setOrientation] = useState<Orientation>('horizontal');

  const handleChangeOrientation = useCallback((orientation: Orientation) => setOrientation(orientation), []);

  if (!enabled) {
    return children;
  }

  return (
    <DevToolsContextProvider>
      <div
        className={classNames('flex grow overflow-auto', {
          'flex-col': orientation === 'horizontal',
          'h-screen': orientation === 'vertical'
        })}
      >
        <div className="basis-0 grow overflow-auto">{children}</div>
        <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />
      </div>
    </DevToolsContextProvider>
  );
};

export default DevToolsContainer;
