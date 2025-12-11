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
import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';
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
  OfflineDataRaw
} from '@plitzi/sdk-shared';

export type AppMainProps = {
  revision?: number;
  webKey?: string;
  webId: number;
  environment?: Environment;
  currentPageId?: string;
  server: Server;
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
  environment = 'development',
  currentPageId,
  // Server
  server,
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
        revision={revision}
        debugMode={debugMode}
      >
        <SchemaContextProvider>
          <CollectionContextProvider>
            <PluginsContextProvider renderMode={renderMode} sdkStylePath={sdkStylePath}>
              <StyleContextProvider>
                <EventBridgeContextProvider onInit={onInitEventBridge}>
                  <SegmentsContextProvider>
                    <UserBaseContextProvider
                      previewMode={previewMode}
                      webId={webId}
                      environment={environment}
                      server={server}
                      renderMode={renderMode}
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
                                  {...sdkProps}
                                />
                              </DevToolsContainer>
                            </InteractionsSdkContextProvider>
                          </DataSourceContextProvider>
                        </StateManagerContextProvider>
                      </NavigationContextProvider>
                    </UserBaseContextProvider>
                  </SegmentsContextProvider>
                </EventBridgeContextProvider>
              </StyleContextProvider>
            </PluginsContextProvider>
          </CollectionContextProvider>
        </SchemaContextProvider>
      </NetworkContextProvider>
    ),
    [
      currentPageId,
      debugMode,
      environment,
      instanceId,
      offlineData,
      offlineDataType,
      offlineMode,
      onInitEventBridge,
      onInitStateManager,
      previewMode,
      renderMode,
      revision,
      sdkProps,
      sdkStylePath,
      server,
      state,
      webId,
      webKey
    ]
  );

  return childrenMemo;
};

export default AppMain;
