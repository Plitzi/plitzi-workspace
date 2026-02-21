import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { use, useMemo, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';

import AppContext from '../AppContext';
import AppHeader from '../components/AppHeader';
import ContainerCollections from './containers/ContainerCollections';
import ContainerDefault from './containers/ContainerDefault';
import ContainerIntegrations from './containers/ContainerIntegrations';
import ContainerMarketplace from './containers/ContainerMarketplace';
import ContainerSettings from './containers/ContainerSettings';
import ContainerSitemap from './containers/ContainerSitemap';
import { getPopups } from '../helpers/utils';

import type { PopupInstance, PopupPlacement, PopupUpdateState } from '@plitzi/plitzi-ui/Popup';
import type { EventBridgeEvent } from '@plitzi/sdk-shared';

export type AppContainerProps = {
  externalStyle?: string;
};

const separatorsBefore = ['layerManager', 'settings'];

const AppContainer = ({ externalStyle = '' }: AppContainerProps) => {
  const { previewMode } = use(AppContext);
  const schemaContext = use(SchemaContext);
  const styleContext = use(StyleContext);
  const { eventBridge } = use(EventBridgeContext);
  const { currentPageId } = use(NavigationContext);
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

  const popups = useMemo(
    () => getPopups({ activeIds: popupsActiveLeft }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="flex grow flex-col overflow-auto">
      <AppHeader />
      <BuilderProvider
        schema={schemaContext.schema}
        style={styleContext.style}
        baseElementId={currentPageId}
        onHandler={builderHandler}
      >
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
              {!['collections', 'marketplace', 'integrations', 'settings', 'sitemap'].includes(popupsActiveLeft[0]) && (
                <ContainerDefault externalStyle={externalStyle} previewMode={previewMode} />
              )}
              {popupsActiveLeft[0] === 'collections' && <ContainerCollections />}
              {popupsActiveLeft[0] === 'marketplace' && <ContainerMarketplace />}
              {popupsActiveLeft[0] === 'integrations' && <ContainerIntegrations />}
              {popupsActiveLeft[0] === 'sitemap' && <ContainerSitemap />}
              {popupsActiveLeft[0] === 'settings' && <ContainerSettings />}
            </div>
          </div>
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

export default AppContainer;
