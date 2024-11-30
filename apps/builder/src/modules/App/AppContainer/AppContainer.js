// Packages
import React, { use, useState, useMemo, useCallback } from 'react';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import Collections from '@pmodules/Collection/Collections';
import Templates from '@pmodules/Templates';
import Elements from '@pmodules/Elements';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';
import Variables from '@pmodules/Variables';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';

// Relatives
import AppHeader from '../components/AppHeader';
import AppContext from '../AppContext';
import AppSidebar from '../components/AppSidebar';
import ContainerDefault from './containers/ContainerDefault';
import ContainerCollections from './containers/ContainerCollections';
import ContainerMarketplace from './containers/ContainerMarketplace';
import ContainerIntegrations from './containers/ContainerIntegrations';
import ContainerSettings from './containers/ContainerSettings';
import AppDirectory from '../components/AppDirectory/AppDirectory';
import { featureFlag } from '../../../config';
// import ContainerSitemap from './containers/ContainerSitemap';

/**
 * @param {{
 *   externalStyle?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const AppContainer = props => {
  const { externalStyle = '' } = props;
  const { previewMode } = use(AppContext);
  const schemaContext = use(SchemaContext);
  const styleContext = use(StyleContext);
  const { eventBridge } = use(EventBridgeContext);
  const { rootDOM } = use(ContainerRootContext);
  const { currentPageId } = use(NavigationContext);
  const resizeHandles = useMemo(() => ['e'], []);
  const [tabSelected, setTabSelected] = useState();
  const [sourceState, setSourceState] = useState({});
  const { sourceId } = sourceState;

  const handleSourceChange = useCallback(sourceId => setSourceState({ sourceId }), [tabSelected]);

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.MAIN, event, ...data),
    [eventBridge]
  );

  return (
    <div className="flex flex-col grow overflow-auto">
      <AppHeader setTabSelected={setTabSelected} />
      <BuilderProvider
        schema={schemaContext.schema}
        style={styleContext.style}
        baseElementId={currentPageId}
        onHandler={builderHandler}
      >
        <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
          <div className="flex relative basis-0 grow bg-grayviolet-200 max-w-[100vw] overflow-hidden">
            {!previewMode && <AppSidebar onSelect={setTabSelected} selected={tabSelected} />}
            {!previewMode && tabSelected && !['marketplace', 'integrations', 'settings'].includes(tabSelected) && (
              <div className="flex h-full bg-white">
                <ContainerResizable
                  parentElement={rootDOM}
                  className="component__container-resizable-sidebar"
                  classNameInternal="basis-0"
                  minConstraintsX={300}
                  maxConstraintsX={500}
                  minConstraintsY={Infinity}
                  width={300}
                  resizeHandles={resizeHandles}
                >
                  {tabSelected === 'elements' && <Elements />}
                  {tabSelected === 'assets' && <Resources />}
                  {tabSelected === 'collections' && (
                    <Collections collectionId={sourceId} onSourceChange={handleSourceChange} />
                  )}
                  {tabSelected === 'segments' && <Segments />}
                  {tabSelected === 'templates' && <Templates />}
                  {tabSelected === 'pages' && <AppDirectory />}
                  {tabSelected === 'variables' && featureFlag.variables && <Variables />}
                </ContainerResizable>
              </div>
            )}
            <div className="flex flex-col grow basis-0 overflow-hidden">
              {!['collections', 'marketplace', 'integrations', 'settings', 'sitemap'].includes(tabSelected) && (
                <ContainerDefault externalStyle={externalStyle} previewMode={previewMode} />
              )}
              {tabSelected === 'collections' && (
                <ContainerCollections key={sourceId} onSourceChange={handleSourceChange} collectionId={sourceId} />
              )}
              {tabSelected === 'marketplace' && <ContainerMarketplace />}
              {tabSelected === 'integrations' && <ContainerIntegrations />}
              {tabSelected === 'settings' && <ContainerSettings />}
              {/* {tabSelected === 'sitemap' && <ContainerSitemap />} */}
            </div>
          </div>
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

export default AppContainer;
