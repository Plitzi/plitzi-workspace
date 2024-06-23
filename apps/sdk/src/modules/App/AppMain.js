// Packages
import React, { useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/utils';

// Alias
import Sdk, { RENDER_MODE_IFRAME } from '@modules/Sdk';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import NavigationContextProvider from '@modules/Navigation/NavigationContextProvider';
import CollectionContextProvider from '@modules/Collection/CollectionContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import StyleContextProvider from '@modules/Style/StyleContextProvider';
import StateManagerContextProvider from '@modules/StateManager/StateManagerContextProvider';
import InteractionsSdkContextProvider from '@modules/Interactions/InteractionsSdkContextProvider';
import DataSourceSdkContextProvider from '@modules/DataSource/DataSourceSdkContextProvider';

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
                    <UserBaseContextProvider previewMode={previewMode} webId={webId}>
                      <NavigationContextProvider
                        renderMode={renderMode}
                        currentPageId={currentPageId}
                        previewMode={previewMode}
                      >
                        <StateManagerContextProvider state={state} onInit={onInitStateManager}>
                          <DataSourceSdkContextProvider>
                            <InteractionsSdkContextProvider previewMode={previewMode}>
                              <Sdk
                                renderMode={renderMode}
                                previewMode={previewMode}
                                environment={environment}
                                {...sdkProps}
                              />
                            </InteractionsSdkContextProvider>
                          </DataSourceSdkContextProvider>
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
