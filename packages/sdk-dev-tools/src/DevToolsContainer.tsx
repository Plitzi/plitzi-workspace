import clsx from 'clsx';
import { useState, useCallback } from 'react';

import DevToolsPanel from './components/DevToolsPanel';
import DevToolsContextProvider from './DevToolsContextProvider';

import type { ReactNode } from 'react';

export type Orientation = 'horizontal' | 'vertical';

export type DevToolsContainerProps = {
  children?: ReactNode;
  className?: string;
  innerClassName?: string;
  enabled?: boolean;
};

const DevToolsContainer = ({ children, className, innerClassName, enabled = false }: DevToolsContainerProps) => {
  const [orientation, setOrientation] = useState<Orientation>('horizontal');

  const handleChangeOrientation = useCallback((orientation: Orientation) => setOrientation(orientation), []);

  if (!enabled) {
    return children;
  }

  return (
    <DevToolsContextProvider>
      <div
        className={clsx(
          'flex grow overflow-auto',
          { 'flex-col': orientation === 'horizontal', 'h-screen': orientation === 'vertical' },
          className
        )}
      >
        <div className={clsx('grow basis-0 flex-col overflow-auto', innerClassName)}>{children}</div>
        <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />
      </div>
    </DevToolsContextProvider>
  );
};

export default DevToolsContainer;
