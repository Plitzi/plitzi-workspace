import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import clsx from 'clsx';
import { useState, useCallback, useEffect } from 'react';

import DevToolsPanel from './components/DevToolsPanel';
import DevToolsContextProvider from './DevToolsContextProvider';

import type { ReactNode } from 'react';

export type Orientation = 'horizontal' | 'vertical';

export type DevToolsContainerProps = {
  children?: ReactNode;
  className?: string;
  innerClassName?: string;
  enabled?: boolean;
  devToolsStyle?: string;
  devToolsStyleLink?: string;
  renderMode?: 'default' | 'shadow';
};

const DevToolsContainer = ({
  children,
  className,
  innerClassName,
  enabled = false,
  renderMode = 'default',
  devToolsStyle = '',
  devToolsStyleLink = ''
}: DevToolsContainerProps) => {
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (typeof document === 'undefined' || renderMode === 'default') {
      return;
    }

    const syncTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDark(isDark);
    };

    const mutationObserver = new MutationObserver(syncTheme);
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      mutationObserver.disconnect();
    };
  }, [renderMode]);

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
        {renderMode === 'default' && (
          <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />
        )}
        {renderMode === 'shadow' && (
          <ContainerShadow>
            {devToolsStyleLink && <ContainerShadow.Link href={devToolsStyleLink} />}
            <ContainerShadow.Content>
              <style dangerouslySetInnerHTML={{ __html: devToolsStyle }} />
              <DevToolsPanel
                className={clsx({ dark: isDark })}
                orientation={orientation}
                onChangeOrientation={handleChangeOrientation}
              />
            </ContainerShadow.Content>
          </ContainerShadow>
        )}
      </div>
    </DevToolsContextProvider>
  );
};

export default DevToolsContainer;
