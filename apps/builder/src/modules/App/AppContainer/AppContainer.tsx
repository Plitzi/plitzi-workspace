import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { use, useMemo, useCallback } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';
import BuilderSearch from '@pmodules/Builder/components/BuilderSearch';
import { useOpenComponent } from '@pmodules/Components';
import FontPreviews from '@pmodules/Fonts/FontPreviews';

import AppContext from '../AppContext';
import AppHeader from '../components/AppHeader';
import ContainerActions from './containers/ContainerActions';
import ContainerConnectors from './containers/ContainerConnectors';
import ContainerCredentials from './containers/ContainerCredentials';
import ContainerDefault from './containers/ContainerDefault';
import ContainerFunctions from './containers/ContainerFunctions';
import ContainerRuntime from './containers/ContainerRuntime';
import ContainerSettings from './containers/ContainerSettings';
import ContainerSitemap from './containers/ContainerSitemap';
import ContainerVisitors from './containers/ContainerVisitors';
import { getPopups } from '../helpers/utils';

import type { PopupInstance, PopupPlacement, PopupUpdateState } from '@plitzi/plitzi-ui/Popup';
import type { EventBridgeEvent } from '@plitzi/sdk-shared';

export type AppContainerProps = {
  externalStyle?: string;
};

const separatorsBefore = ['layerManager', 'settings'];

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

  const [platformFlags] = useBuilderStore('platformFlags');
  // The active ids are read once, as the panels open; the platform's flags are kept, because they arrive with the
  // editor's first query and decide which panels exist at all.
  const popups = useMemo(
    () => getPopups({ activeIds: popupsActiveLeft, platformFlags }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platformFlags]
  );

  return (
    <div className="flex grow flex-col overflow-auto">
      {/* The space's families, in the EDITOR's document — the canvas is an iframe, and nothing it loads reaches
          the panels that have to draw a font's name in its own typeface. */}
      <FontPreviews />
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
              <div className="bg-grayviolet-200 relative flex max-w-screen grow basis-0 overflow-hidden">
                {!previewMode && (
                  <PopupSidePanel
                    size="md"
                    className="max-h-[calc(100vh-48px)] overflow-y-auto"
                    placementTabs="left"
                    placement="left"
                    separatorsBefore={separatorsBefore}
                    minWidth={335}
                    maxWidth={800}
                    canHide
                  />
                )}
                <div className="flex grow basis-0 flex-col overflow-hidden">
                  {![
                    'actions',
                    'functions',
                    'runtime',
                    'connectors',
                    'credentials',
                    'visitors',
                    'settings',
                    'sitemap'
                  ].includes(popupsActiveLeft[0]) && (
                    <ContainerDefault externalStyle={externalStyle} previewMode={previewMode} />
                  )}
                  {popupsActiveLeft[0] === 'actions' && <ContainerActions />}
                  {popupsActiveLeft[0] === 'functions' && <ContainerFunctions />}
                  {popupsActiveLeft[0] === 'runtime' && <ContainerRuntime />}
                  {popupsActiveLeft[0] === 'connectors' && <ContainerConnectors />}
                  {popupsActiveLeft[0] === 'credentials' && <ContainerCredentials />}
                  {popupsActiveLeft[0] === 'visitors' && <ContainerVisitors />}
                  {popupsActiveLeft[0] === 'sitemap' && <ContainerSitemap />}
                  {popupsActiveLeft[0] === 'settings' && <ContainerSettings />}
                </div>
              </div>
            </PopupProvider>
          </BuilderProvider>
        </StoreProvider>
      </BuilderSearch>
    </div>
  );
};

export default AppContainer;
