import clsx from 'clsx';

import CollectionContextProvider from '@modules/Collection/CollectionContextProvider';
import InteractionsSdkContextProvider from '@modules/Interactions/InteractionsSdkContextProvider';
import NavigationContextProvider from '@modules/Navigation/NavigationContextProvider';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import Sdk from '@modules/Sdk';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';
import SdkStyleContextProvider from '@plitzi/sdk-style/SdkStyleContextProvider';

import devtoolsCssUrl from '../../assets/plitzi-sdk-devtools.scss?url';
import styleUrl from '../../assets/plitzi-sdk.scss?url';

import type {
  Environment,
  Server,
  RenderMode,
  StateManagerContextValue,
  EventBridgeContextValue,
  OfflineDataRaw,
  ServerEnvironment
} from '@plitzi/sdk-shared';

export type AppMainProps = {
  revision?: number;
  webKey?: string;
  webId: number;
  environment?: Environment;
  sdkEnvironment?: ServerEnvironment;
  currentPageId?: string;
  server: Server;
  isHydrating?: boolean;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
  instanceId?: string;
  renderMode?: RenderMode;
  sdkStylePath?: string;
  sdkDevToolsStylePath?: string;
  previewMode?: boolean;
  debugMode?: boolean;
  state?: Record<string, unknown>;
  onInitStateManager?: (instance: StateManagerContextValue) => void;
  onInitEventBridge?: (instance: EventBridgeContextValue) => void;
};

const AppMain = ({
  // Space
  revision,
  webKey = '',
  webId,
  environment = 'main',
  currentPageId,
  // Server
  server,
  isHydrating = false,
  sdkEnvironment = 'production',
  offlineMode = false,
  offlineData,
  offlineDataType = 'json',
  // Extra
  instanceId,
  renderMode = 'iframe',
  sdkStylePath = './plitzi-sdk.css',
  sdkDevToolsStylePath = './plitzi-sdk-devtools.css',
  previewMode = true,
  debugMode = false,
  state,
  onInitEventBridge,
  onInitStateManager,
  ...sdkProps
}: AppMainProps) => {
  return (
    <NetworkContextProvider
      webKey={webKey}
      webId={webId}
      instanceId={instanceId}
      server={server}
      offlineMode={offlineMode}
      offlineData={offlineData}
      offlineDataType={offlineDataType}
      environment={environment}
      sdkEnvironment={sdkEnvironment}
      revision={revision}
      debugMode={debugMode}
    >
      <SchemaContextProvider>
        <CollectionContextProvider>
          <PluginsContextProvider renderMode={renderMode} sdkStylePath={styleUrl ? styleUrl : sdkStylePath}>
            <SdkStyleContextProvider>
              <EventBridgeContextProvider onInit={onInitEventBridge} debugMode={debugMode}>
                <SegmentsContextProvider>
                  <AuthContextProvider
                    previewMode={previewMode}
                    environment={environment}
                    server={server}
                    isHydrating={isHydrating}
                  >
                    <NavigationContextProvider
                      renderMode={renderMode}
                      currentPageId={currentPageId}
                      previewMode={previewMode}
                    >
                      <StateManagerContextProvider webId={webId} state={state} onInit={onInitStateManager}>
                        <DataSourceContextProvider environment={environment}>
                          <InteractionsSdkContextProvider previewMode={previewMode}>
                            <DevToolsContainer
                              enabled={debugMode}
                              devToolsStyleLink={devtoolsCssUrl ? devtoolsCssUrl : sdkDevToolsStylePath}
                              renderMode="shadow"
                              innerClassName={clsx({ flex: renderMode === 'iframe' })}
                            >
                              <Sdk
                                renderMode={renderMode}
                                previewMode={previewMode}
                                debugMode={debugMode}
                                environment={environment}
                                isHydrating={isHydrating}
                                sdkStylePath={styleUrl ? styleUrl : sdkStylePath}
                                server={server}
                                {...sdkProps}
                              />
                            </DevToolsContainer>
                          </InteractionsSdkContextProvider>
                        </DataSourceContextProvider>
                      </StateManagerContextProvider>
                    </NavigationContextProvider>
                  </AuthContextProvider>
                </SegmentsContextProvider>
              </EventBridgeContextProvider>
            </SdkStyleContextProvider>
          </PluginsContextProvider>
        </CollectionContextProvider>
      </SchemaContextProvider>
    </NetworkContextProvider>
  );
};

export default AppMain;
