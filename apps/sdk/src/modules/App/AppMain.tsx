import { useMemo } from 'react';

import CollectionContextProvider from '@modules/Collection/CollectionContextProvider';
import InteractionsSdkContextProvider from '@modules/Interactions/InteractionsSdkContextProvider';
import NavigationContextProvider from '@modules/Navigation/NavigationContextProvider';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import Sdk from '@modules/Sdk';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import StyleContextProvider from '@modules/Style/StyleContextProvider';
import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';

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
  previewMode = true,
  debugMode = false,
  state,
  onInitEventBridge,
  onInitStateManager,
  ...sdkProps
}: AppMainProps) => {
  const childrenMemo = useMemo(
    () => (
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
            <PluginsContextProvider renderMode={renderMode} sdkStylePath={sdkStylePath}>
              <StyleContextProvider>
                <EventBridgeContextProvider onInit={onInitEventBridge}>
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
                              <DevToolsContainer enabled={debugMode}>
                                <Sdk
                                  renderMode={renderMode}
                                  previewMode={previewMode}
                                  debugMode={debugMode}
                                  environment={environment}
                                  isHydrating={isHydrating}
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
              </StyleContextProvider>
            </PluginsContextProvider>
          </CollectionContextProvider>
        </SchemaContextProvider>
      </NetworkContextProvider>
    ),
    [
      webKey,
      webId,
      instanceId,
      server,
      offlineMode,
      offlineData,
      offlineDataType,
      environment,
      sdkEnvironment,
      revision,
      debugMode,
      renderMode,
      sdkStylePath,
      onInitEventBridge,
      previewMode,
      isHydrating,
      currentPageId,
      state,
      onInitStateManager,
      sdkProps
    ]
  );

  return childrenMemo;
};

export default AppMain;
