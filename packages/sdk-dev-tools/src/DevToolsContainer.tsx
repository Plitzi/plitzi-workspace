import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

import { DevStoreScopeContext } from '@plitzi/nexus/react';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';

import DevToolsOverlay from './components/DevToolsOverlay';
import DevToolsContextProvider from './DevToolsContextProvider';
import DevToolsRoot from './DevToolsRoot';
import { useIsSelectedInstance } from './instanceRegistry';
import useHydrated from './useHydrated';
import useRegisterQueriesStore from './useRegisterQueriesStore';
import useRegisterRootStore from './useRegisterRootStore';

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
  /**
   * What scrolls while the panel is folded away.
   *
   * `container` (the default) keeps the wrapped app in a box of its own, which is what an application shell that fills
   * its window wants — the builder. `document` is for a PAGE: while the panel is collapsed the page lays out and
   * scrolls exactly as it does without dev tools, so `position: sticky` and `fixed`, scroll restoration and a
   * full-page screenshot mean in development what they mean in production. Opening the panel docks it beside the page
   * either way; a docked panel needs the split.
   */
  scroll?: 'container' | 'document';
};

const DevToolsContainer = ({
  children,
  className,
  innerClassName,
  enabled = false,
  instanceId,
  renderMode = 'default',
  scroll = 'container',
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
  useRegisterRootStore(enabled);
  useRegisterQueriesStore(isSelected, effectiveInstanceId);

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

  // The page stays in the document's flow only while there is no panel to share the screen with. Read as collapsed
  // until hydration, like the dock position above: the server has no storage to know otherwise.
  const inFlow = scroll === 'document' && (!hydrated || collapsed);
  const overlay = isSelected && hydrated && (
    <DevToolsRoot>
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
    </DevToolsRoot>
  );

  return (
    <div
      className={clsx(
        // `relative` so the collapsed badge anchors HERE rather than to the window: a host that gives the space one
        // pane of its window — the desktop app, beside its sidebar — had the badge land on top of the host's chrome.
        // `min-w-0` because the host lays this out as a flex item: with no overflow of its own to pin it, its minimum
        // width is its content's, and a marquee or a wide table stretched the whole page sideways.
        'relative flex min-w-0 grow',
        {
          'overflow-auto': !inFlow,
          'flex-col': inFlow || dockedAt === 'horizontal',
          'h-screen': !inFlow && dockedAt === 'vertical'
        },
        className
      )}
    >
      {/* Tag every nested StoreProvider below with this instance's id so the panel's scope dropdown can group them. */}
      <DevStoreScopeContext value={effectiveInstanceId}>
        <div className={clsx('grow', { 'basis-0 flex-col overflow-auto': !inFlow }, innerClassName)}>{children}</div>
      </DevStoreScopeContext>
      {/* In flow the page is as tall as its content, so the badge rides a zero-height anchor stuck to the bottom of
          whatever scrolls — the window, or the pane a host gave the space. */}
      {inFlow ? <div className="sticky bottom-0 h-0">{overlay}</div> : overlay}
    </div>
  );
};

export default DevToolsContainer;
