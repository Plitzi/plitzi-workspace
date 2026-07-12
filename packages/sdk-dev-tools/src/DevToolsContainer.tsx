import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, use, useRef } from 'react';

import { DevStoreScopeContext } from '@plitzi/nexus/react';
import { ThemeContext } from '@plitzi/sdk-shared';

import DevToolsPanel from './components/DevToolsPanel';
import DevToolsContextProvider from './DevToolsContextProvider';
import { useIsSelectedInstance } from './instanceRegistry';

import type { ReactNode } from 'react';

export type Orientation = 'horizontal' | 'vertical';

// Fallback identity for callers that don't pass an `instanceId` (e.g. the builder's single instance): a stable,
// process-unique label so the instance dropdown still has something to show.
let fallbackInstanceSeq = 0;

export type DevToolsContainerProps = {
  children?: ReactNode;
  className?: string;
  innerClassName?: string;
  enabled?: boolean;
  // Identifies this SDK instance in the panel's instance dropdown. Several instances share one panel.
  instanceId?: string;
  devToolsStyle?: string;
  devToolsStyleLink?: string;
  renderMode?: 'default' | 'shadow';
};

const DevToolsContainer = ({
  children,
  className,
  innerClassName,
  enabled = false,
  instanceId,
  renderMode = 'default',
  devToolsStyle = '',
  devToolsStyleLink = ''
}: DevToolsContainerProps) => {
  const { theme } = use(ThemeContext);
  const [orientation, setOrientation] = useStorage<Orientation>('plitzi-sdk.dev-tools.orientation', 'horizontal');
  const fallbackIdRef = useRef<string>(undefined);
  if (!fallbackIdRef.current) {
    fallbackIdRef.current = `sdk-instance-${++fallbackInstanceSeq}`;
  }

  const effectiveInstanceId = instanceId ? instanceId : fallbackIdRef.current;
  // Only the selected instance renders the (single) panel; all enabled instances still register in the dropdown.
  const isSelected = useIsSelectedInstance(effectiveInstanceId, enabled);

  const handleChangeOrientation = useCallback(
    (orientation: Orientation) => setOrientation(orientation),
    [setOrientation]
  );

  if (!enabled) {
    return children;
  }

  return (
    <div
      className={clsx(
        'flex grow overflow-auto',
        { 'flex-col': orientation === 'horizontal', 'h-screen': orientation === 'vertical' },
        className
      )}
    >
      {/* Tag every nested StoreProvider below with this instance's id so the panel's scope dropdown can group them. */}
      <DevStoreScopeContext value={effectiveInstanceId}>
        <div className={clsx('grow basis-0 flex-col overflow-auto', innerClassName)}>{children}</div>
      </DevStoreScopeContext>
      {isSelected && (
        <DevToolsContextProvider>
          {renderMode === 'default' && (
            <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />
          )}
          {renderMode === 'shadow' && (
            <ContainerShadow>
              {devToolsStyleLink && <ContainerShadow.Link href={devToolsStyleLink} />}
              <ContainerShadow.Content>
                <style dangerouslySetInnerHTML={{ __html: devToolsStyle }} />
                <DevToolsPanel
                  className={clsx({ dark: theme === 'dark' })}
                  orientation={orientation}
                  onChangeOrientation={handleChangeOrientation}
                />
              </ContainerShadow.Content>
            </ContainerShadow>
          )}
        </DevToolsContextProvider>
      )}
    </div>
  );
};

export default DevToolsContainer;
