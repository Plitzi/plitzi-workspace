// Packages
import React, { useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/utils';
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';

// Alias
import Sdk, { RENDER_MODE_IFRAME } from '@modules/Sdk';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import NavigationContextProvider from '@modules/Navigation/NavigationContextProvider';
import CollectionContextProvider from '@modules/Collection/CollectionContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import StyleContextProvider from '@modules/Style/StyleContextProvider';
import InteractionsSdkContextProvider from '@modules/Interactions/InteractionsSdkContextProvider';

/**
 * @param {{
 *   revision?: string;
 *   webKey?: string;
 *   environment?: string;
 *   currentPageId?: string;
 *   server?: {
 *     graphqlServer: string;
 *     basePath?: string;
 *     subscriptionServer?: string;
 *     host?: string;
 *     websocketServer?: string;
 *   };
 *   offlineMode?: boolean;
 *   offlineData?: {
 *     schema: object;
 *     style: object;
 *     plugins: object;
 *     segments: object[];
 *   };
 *   offlineDataType?: 'json' | 'yaml';
 *   renderMode?: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 *   sdkStylePath?: string;
 *   previewMode?: boolean;
 *   debugMode?: boolean;
 *   state?: object;
 *   onInitEventBridge?: Function;
 *   onInitStateManager?: Function;
 * }} props
 * @returns {React.ReactElement}
 */
const AppMain = props => {
  const {
    // Space
    revision,
    webKey = '',
    environment = 'development',
    currentPageId,
    // Server
    server,
    offlineMode = false,
    offlineData,
    offlineDataType = 'json',
    // Extra
    renderMode = RENDER_MODE_IFRAME,
    sdkStylePath = './plitzi-sdk.css',
    previewMode = true,
    debugMode = false,
    state,
    onInitEventBridge = noop,
    onInitStateManager = noop,
    ...sdkProps
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);

  const childrenMemo = useMemo(
    () => (
      <NetworkContextProvider
        webKey={webKey}
        webId={webId}
        server={server}
        offlineMode={offlineMode}
        offlineData={offlineData}
        offlineDataType={offlineDataType}
        environment={environment}
        revision={revision}
      >
        <SchemaContextProvider>
          <CollectionContextProvider>
            <PluginsContextProvider renderMode={renderMode} sdkStylePath={sdkStylePath}>
              <StyleContextProvider>
                <EventBridgeContextProvider onInit={onInitEventBridge}>
                  <SegmentsContextProvider>
                    <UserBaseContextProvider previewMode={previewMode} webId={webId} environment={environment}>
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
    [props]
  );

  return childrenMemo;
};

export default AppMain;
