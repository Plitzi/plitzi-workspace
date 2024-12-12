// Packages
import React, { use, useState, useMemo, useCallback } from 'react';
import PopupProvider from '@plitzi/plitzi-ui/Popup/PopupProvider';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';
import StateManagerIcon from '@plitzi/plitzi-ui/icons/StateManager';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import StateManager from '@pmodules/StateManager/StateManager';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';
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
  const { currentPageId } = use(NavigationContext);
  const [tabSelected, setTabSelected] = useState();
  const [sourceState, setSourceState] = useState({});
  const { sourceId } = sourceState;

  const handleSourceChange = useCallback(sourceId => setSourceState({ sourceId }), [tabSelected]);

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.MAIN, event, ...data),
    [eventBridge]
  );

  const popups = useMemo(() => {
    const left = [
      {
        id: 'elements',
        component: <Elements />,
        active: false,
        settings: {
          icon: 'fa-solid fa-plus',
          title: 'Add Element',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'pages',
        component: <AppDirectory />,
        active: false,
        settings: {
          icon: 'fas fa-file',
          title: 'Pages',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      }
    ];

    if (featureFlag.variables) {
      left.push({
        id: 'variables',
        component: <Variables />,
        active: false,
        settings: {
          icon: (
            <Sidebar.Icon className="p-2" intent="tertiary" id="variables" title="Variables">
              <Variable />
            </Sidebar.Icon>
          ),
          title: 'Variables',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      });
    }

    left.push(
      {
        id: 'assets',
        component: <Resources />,
        active: false,
        settings: {
          icon: 'fa-solid fa-image',
          title: 'Resources',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'collections',
        component: <Collections collectionId={sourceId} onSourceChange={handleSourceChange} />,
        active: false,
        settings: {
          icon: 'fas fa-database',
          title: 'Collections',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'segments',
        component: <Segments />,
        active: false,
        settings: {
          icon: 'fa-solid fa-diamond',
          title: 'Segments',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'templates',
        component: <Templates />,
        active: false,
        settings: {
          icon: 'fa-solid fa-clone',
          title: 'Templates',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'layerManager',
        component: <BuilderTree />,
        active: false,
        settings: {
          icon: 'fa-solid fa-layer-group',
          title: 'Layers',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          // allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'advanceStyle',
        component: <StyleAdvanceEditor />,
        active: false,
        settings: {
          icon: 'fa-solid fa-file-code text-base',
          title: 'Advance Style',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          // allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'stateManager',
        component: <StateManager />,
        active: false,
        settings: {
          icon: (
            <Sidebar.Icon className="p-2" intent="tertiary" id="variables" title="Variables">
              <StateManagerIcon />
            </Sidebar.Icon>
          ),
          title: 'State Manager',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          // allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      },
      {
        id: 'settings',
        component: undefined,
        active: false,
        settings: {
          icon: 'fas fa-cog',
          title: 'Settings',
          width: 350,
          allowLeftSide: true,
          allowRightSide: false,
          allowFloatingSide: false,
          allowClose: false,
          resizeHandles: ['se']
        }
      }
    );

    return { left, right: [], floating: [] };
  }, [sourceId, handleSourceChange]);

  return (
    <div className="flex flex-col grow overflow-auto">
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
          <div className="flex relative basis-0 grow bg-grayviolet-200 max-w-[100vw] overflow-hidden">
            {!previewMode && <AppSidebar onSelect={setTabSelected} selected={tabSelected} />}
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
