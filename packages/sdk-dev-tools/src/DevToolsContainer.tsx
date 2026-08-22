import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, use, useRef, useState } from 'react';

import { DevStoreScopeContext } from '@plitzi/nexus/react';
import { ThemeContext } from '@plitzi/sdk-shared';

import DevToolsOverlay from './components/DevToolsOverlay';
import DevToolsContextProvider from './DevToolsContextProvider';
import { useIsSelectedInstance } from './instanceRegistry';

import type { LogType } from '@plitzi/sdk-shared';
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
  const { resolvedTheme } = use(ThemeContext);
  const [orientation, setOrientation] = useStorage<Orientation>('plitzi-sdk.dev-tools.orientation', 'horizontal');
  const [collapsed, setCollapsed] = useStorage('plitzi-sdk.dev-tools.collapsed', true);
  const [tabSelected, setTabSelected] = useStorage('plitzi-sdk.dev-tools.tab', 'logs');
  // Which filter the Logs tab opens on. Lives here because the indicator — outside the panel — is what asks for it,
  // and it is dropped as soon as the user picks a tab themselves.
  const [logTypeFilter, setLogTypeFilter] = useState<LogType | undefined>();
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

  const handleOpen = useCallback(
    (logType?: LogType) => {
      if (logType) {
        setTabSelected('logs');
      }

      setLogTypeFilter(logType);
      setCollapsed(false);
    },
    [setCollapsed, setTabSelected]
  );

  const handleCollapse = useCallback(() => setCollapsed(true), [setCollapsed]);

  const handleTabSelect = useCallback(
    (tab: string) => {
      setLogTypeFilter(undefined);
      setTabSelected(tab);
    },
    [setTabSelected]
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
            <DevToolsOverlay
              className={clsx({ dark: resolvedTheme === 'dark' })}
              collapsed={collapsed}
              orientation={orientation}
              tabSelected={tabSelected}
              logTypeFilter={logTypeFilter}
              onOpen={handleOpen}
              onCollapse={handleCollapse}
              onTabSelect={handleTabSelect}
              onChangeOrientation={handleChangeOrientation}
            />
          )}
          {renderMode === 'shadow' && (
            <ContainerShadow>
              {devToolsStyleLink && <ContainerShadow.Link href={devToolsStyleLink} />}
              <ContainerShadow.Content>
                <style dangerouslySetInnerHTML={{ __html: devToolsStyle }} />
                <DevToolsOverlay
                  className={clsx({ dark: resolvedTheme === 'dark' })}
                  collapsed={collapsed}
                  orientation={orientation}
                  tabSelected={tabSelected}
                  logTypeFilter={logTypeFilter}
                  onOpen={handleOpen}
                  onCollapse={handleCollapse}
                  onTabSelect={handleTabSelect}
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
