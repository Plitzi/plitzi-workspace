import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

import { DevStoreScopeContext } from '@plitzi/nexus/react';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';

import DevToolsOverlay from './components/DevToolsOverlay';
import DevToolsContextProvider from './DevToolsContextProvider';
import { useIsSelectedInstance } from './instanceRegistry';
import useHydrated from './useHydrated';

import type { LogType } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type Orientation = 'horizontal' | 'vertical';

/** What the server renders with, because it is what a page with nothing remembered yet gets. */
const DEFAULT_ORIENTATION: Orientation = 'horizontal';

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
  const { resolvedTheme } = useTheme();
  const [orientation, setOrientation] = useStorage<Orientation>(
    'plitzi-sdk.dev-tools.orientation',
    DEFAULT_ORIENTATION
  );
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
  /**
   * Everything below that comes out of `localStorage` waits for hydration to finish.
   *
   * Where the panel is docked decides this container's own layout classes, so remembering it is the one piece of
   * dev-tools state a hydrated page cannot read early: the client would lay the page out one way while the server
   * laid it out the other, and React does not patch that up — it leaves the two disagreeing.
   */
  const hydrated = useHydrated();
  const dockedAt = hydrated ? orientation : DEFAULT_ORIENTATION;
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
        { 'flex-col': dockedAt === 'horizontal', 'h-screen': dockedAt === 'vertical' },
        className
      )}
    >
      {/* Tag every nested StoreProvider below with this instance's id so the panel's scope dropdown can group them. */}
      <DevStoreScopeContext value={effectiveInstanceId}>
        <div className={clsx('grow basis-0 flex-col overflow-auto', innerClassName)}>{children}</div>
      </DevStoreScopeContext>
      {isSelected && hydrated && (
        <DevToolsContextProvider>
          {renderMode === 'default' && (
            <DevToolsOverlay
              className={clsx({ dark: resolvedTheme === 'dark' })}
              collapsed={collapsed}
              orientation={dockedAt}
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
                  orientation={dockedAt}
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
