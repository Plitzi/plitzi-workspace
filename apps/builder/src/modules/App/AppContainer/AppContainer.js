// Packages
import React, { useContext, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';

// Alias
import Plugins from '@pmodules/Plugins';
import Collections from '@pmodules/Collection/Collections';
import Templates from '@pmodules/Templates';
import Elements from '@pmodules/Elements';
import Resources from '@pmodules/Resources';
import Segments from '@pmodules/Segments';

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
// import ContainerSitemap from './containers/ContainerSitemap';

const AppContainer = props => {
  const { externalStyle = '' } = props;
  const { previewMode } = useContext(AppContext);
  const { rootDOM } = useContext(ContainerRootContext);
  const resizeHandles = useMemo(() => ['e'], []);
  const [tabSelected, setTabSelected] = useState();
  const [sourceState, setSourceState] = useState({});
  const { sourceId } = sourceState;

  const handleSourceChange = useCallback(sourceId => setSourceState({ sourceId }), [tabSelected]);

  return (
    <div className="flex flex-col grow overflow-auto">
      <AppHeader />
      <div className="flex relative basis-0 grow bg-blue-100">
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
              {tabSelected === 'plugins' && <Plugins />}
              {tabSelected === 'templates' && <Templates />}
              {tabSelected === 'pages' && <AppDirectory />}
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

AppContainer.propTypes = {
  externalStyle: PropTypes.string
};

export default AppContainer;
