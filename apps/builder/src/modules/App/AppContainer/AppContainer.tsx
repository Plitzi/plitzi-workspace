import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { use, useMemo, useCallback } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';
import BuilderSearch from '@pmodules/Builder/components/BuilderSearch';
import { useOpenComponent } from '@pmodules/Components';
import FontPreviews from '@pmodules/Fonts/FontPreviews';
import ShortcutsProvider from '@pmodules/Shortcuts';
import { useSpaceAccess } from '@pmodules/Space/hooks/useSpaceEntitlements';
import { TestStudioProvider } from '@pmodules/Tests';

import AppContext from '../AppContext';
import AppHeader from '../components/AppHeader';
import ContainerDefault from './containers/ContainerDefault';
import ContainerServer from './containers/ContainerServer';
import ContainerSettings from './containers/ContainerSettings';
import ContainerSitemap from './containers/ContainerSitemap';
import ContainerTests from './containers/ContainerTests';
import { getPopups, isFullViewId } from '../helpers/utils';
import useSitemapOpen from '../hooks/useSitemapOpen';

import type { FullViewId } from '../helpers/utils';
import type { PopupInstance, PopupPlacement, PopupUpdateState } from '@plitzi/plitzi-ui/Popup';
import type { EventBridgeEvent } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppContainerProps = {
  externalStyle?: string;
};

const separatorsBefore = ['layerManager', 'server'];

const LEFT_PANEL_WIDTH = 335;

const fullViewOf = (id: FullViewId, externalStyle: string): ReactNode =>
  id === 'tests' ? (
    <ContainerTests externalStyle={externalStyle} />
  ) : id === 'server' ? (
    <ContainerServer />
  ) : (
    <ContainerSettings />
  );

const AppContainer = ({ externalStyle = '' }: AppContainerProps) => {
  const { previewMode } = use(AppContext);
  const { eventBridge } = use(EventBridgeContext);
  const [currentPageId] = useBuilderStore('navigation.currentPageId');
  // A component open in the canvas is its root — and the whole builder below is drawn in its scope, so the layers, the
  // element tools and the canvas find its elements by id like a page's. Keyed by the component: a scope applies a new
  // value after the render that hands it over, and the canvas resolves its root DURING that render, so opening one
  // into a scope already mounted drew nothing. A fresh scope holds the component's tree from its first render.
  const { component, scope } = useOpenComponent();
  const baseElementId = component ? component.rootId : currentPageId;
  const [popupsActiveLeft, setPopupsActiveLeft] = useStorage<string[]>(
    'builder-state.popupSidePanel.popupsActive.left',
    []
  );
  const [, setPopupsActiveRight] = useStorage<string[]>('builder-state.popupSidePanel.popupsActive.right', []);
  const [leftWidth, setLeftWidth] = useStorage('builder-state.popupSidePanel.width.left', LEFT_PANEL_WIDTH);
  const [sitemapOpen] = useSitemapOpen();
  // What replaces the canvas: an entry of the sidebar that is a whole view, or else the pages' map. An id kept from
  // an older builder names nothing here, and the canvas is drawn.
  const activeView = popupsActiveLeft[0];
  const fullView = isFullViewId(activeView) ? fullViewOf(activeView, externalStyle) : undefined;

  const handleChangePopups = useCallback(
    (placement: PopupPlacement, _state: PopupUpdateState, popups: Record<PopupPlacement, PopupInstance[]>) => {
      const valueParsed = popups[placement].filter(p => p.active).map(p => p.id);
      if (placement === 'left') {
        setPopupsActiveLeft(valueParsed);
      } else if (placement === 'right') {
        setPopupsActiveRight(valueParsed);
      }
    },
    [setPopupsActiveLeft, setPopupsActiveRight]
  );

  const builderHandler = useCallback(
    (event: EventBridgeEvent, data: unknown[]) => void eventBridge.emit('main', event, ...data),
    [eventBridge]
  );

  const { may } = useSpaceAccess();
  // The active ids are read as the panels open: what the person opens afterwards is the panels' own state. They open
  // again whenever a component is opened or closed — the scope they are drawn in is keyed by it — and then they have to
  // open as the person left them, not as they were when the builder loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const popups = useMemo(() => getPopups({ activeIds: popupsActiveLeft, may }), [component?.id, may]);

  return (
    <div className="flex grow flex-col overflow-auto">
      {/* The space's families, in the EDITOR's document — the canvas is an iframe, and nothing it loads reaches
          the panels that have to draw a font's name in its own typeface. */}
      <FontPreviews />
      <TestStudioProvider>
        <BuilderSearch>
          <AppHeader />
          <StoreProvider key={component?.id ?? ''} inherit="live" name="OpenComponent" value={scope}>
            <BuilderProvider baseElementId={baseElementId} onHandler={builderHandler}>
              <PopupProvider
                popups={popups}
                multi
                multiExpanded
                onChange={handleChangePopups}
                renderLeftPopup={false}
                renderRightPopup={false}
                renderFloatingPopup={!previewMode}
              >
                <ShortcutsProvider>
                  <div className="bg-grayviolet-200 relative flex max-w-screen grow basis-0 overflow-hidden">
                    {/* A whole view is not the page previewed: its sidebar stays, the Tests view's canvas in preview. */}
                    {(!previewMode || fullView) && (
                      <PopupSidePanel
                        size="md"
                        className="max-h-[calc(100vh-48px)] overflow-y-auto"
                        placementTabs="left"
                        placement="left"
                        separatorsBefore={separatorsBefore}
                        minWidth={280}
                        maxWidth={800}
                        width={leftWidth}
                        canHide
                        onResize={setLeftWidth}
                      />
                    )}
                    <div className="flex grow basis-0 flex-col overflow-hidden">
                      {fullView}
                      {!fullView && sitemapOpen && <ContainerSitemap />}
                      {!fullView && !sitemapOpen && (
                        <ContainerDefault externalStyle={externalStyle} previewMode={previewMode} />
                      )}
                    </div>
                  </div>
                </ShortcutsProvider>
              </PopupProvider>
            </BuilderProvider>
          </StoreProvider>
        </BuilderSearch>
      </TestStudioProvider>
    </div>
  );
};

export default AppContainer;
