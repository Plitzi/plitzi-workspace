// Packages
import React, { use, useState, useMemo, useCallback } from 'react';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';

// Alias
import Collections from '@pmodules/Collection/Collections';
import Templates from '@pmodules/Templates';
import Elements from '@pmodules/Elements';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';
import Variables from '@pmodules/Variables';

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
  const { rootDOM } = use(ContainerRootContext);
  const resizeHandles = useMemo(() => ['e'], []);
  const [tabSelected, setTabSelected] = useState();
  const [sourceState, setSourceState] = useState({});
  const { sourceId } = sourceState;

  const handleSourceChange = useCallback(sourceId => setSourceState({ sourceId }), [tabSelected]);

  return (
    <div className="flex flex-col grow overflow-auto">
      <AppHeader setTabSelected={setTabSelected} />
      <div className="flex relative basis-0 grow bg-grayviolet-200 max-w-[100vw]">
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
    </div>
  );
};

export default AppContainer;
