import { PopupProvider } from '@plitzi/plitzi-ui/Popup';
import { use, useState, useMemo, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';

import AppContext from '../AppContext';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ContainerCollections from './containers/ContainerCollections';
import ContainerDefault from './containers/ContainerDefault';
import ContainerIntegrations from './containers/ContainerIntegrations';
import ContainerMarketplace from './containers/ContainerMarketplace';
import ContainerSettings from './containers/ContainerSettings';
import ContainerSitemap from './containers/ContainerSitemap';
import { featureFlag } from '../../../config';
import { getPopups } from '../helpers/utils';

import type { EventBridgeEvent } from '@plitzi/sdk-shared';

export type AppContainerProps = {
  externalStyle?: string;
};

const AppContainer = ({ externalStyle = '' }: AppContainerProps) => {
  const { previewMode } = use(AppContext);
  const schemaContext = use(SchemaContext);
  const styleContext = use(StyleContext);
  const { eventBridge } = use(EventBridgeContext);
  const { currentPageId } = use(NavigationContext);
  const [tabSelected, setTabSelected] = useState<string>('');
  const [sourceState, setSourceState] = useState<{ sourceId?: string }>({ sourceId: '' });
  const { sourceId } = sourceState;

  const handleSourceChange = useCallback((newSourceId?: string) => setSourceState({ sourceId: newSourceId }), []);

  const builderHandler = useCallback(
    (event: EventBridgeEvent, data: unknown[]) => void eventBridge.emit('main', event, ...data),
    [eventBridge]
  );

  const popups = useMemo(() => getPopups({ sourceId, handleSourceChange }), [sourceId, handleSourceChange]);

  return (
    <div className="flex grow flex-col overflow-auto">
      <AppHeader setTabSelected={setTabSelected} />
      <BuilderProvider
        schema={schemaContext.schema}
        style={styleContext.style}
        baseElementId={currentPageId}
        onHandler={builderHandler}
      >
        <PopupProvider
          popups={popups}
          renderLeftPopup={false}
          renderRightPopup={false}
          renderFloatingPopup={!previewMode}
        >
          <div className="bg-grayviolet-200 relative flex max-w-screen grow basis-0 overflow-hidden">
            {!previewMode && <AppSidebar onSelect={setTabSelected} />}
            <div className="flex grow basis-0 flex-col overflow-hidden">
              {!['collections', 'marketplace', 'integrations', 'settings', 'sitemap'].includes(tabSelected) && (
                <ContainerDefault externalStyle={externalStyle} previewMode={previewMode} />
              )}
              {tabSelected === 'collections' && (
                <ContainerCollections key={sourceId} onSourceChange={handleSourceChange} collectionId={sourceId} />
              )}
              {tabSelected === 'marketplace' && <ContainerMarketplace />}
              {tabSelected === 'integrations' && <ContainerIntegrations />}
              {featureFlag.sitemap && tabSelected === 'sitemap' && <ContainerSitemap />}
              {tabSelected === 'settings' && <ContainerSettings />}
            </div>
          </div>
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

export default AppContainer;
