// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Monorepo
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import UserContextProvider from '@plitzi/sdk-auth/UserContextProvider';
import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';

// Alias
import Sdk, {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk';
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
    state = undefined,
    onInitEventBridge = noop,
    onInitStateManager = noop,
    ...sdkProps
  } = props;
  const webKeyDecoded = useMemo(() => {
    let tokenDecoded = {};
    if (!webKey) {
      return tokenDecoded;
    }

    try {
      if (typeof window !== 'undefined') {
        tokenDecoded = JSON.parse(window.atob(webKey.split('.')[1], 'base64').toString());
      } else {
        tokenDecoded = JSON.parse(Buffer.from(webKey.split('.')[1], 'base64').toString());
      }
    } catch (e) {
      return {};
    }

    return tokenDecoded;
  }, [webKey]);

  const webId = useMemo(() => `${get(webKeyDecoded, 'data.spaceId', '')}`, [webKeyDecoded]);

  const childrenMemo = useMemo(
    () => (
      <NetworkContextProvider
        webKey={webKey}
        webKeyDecoded={webKeyDecoded}
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
                              <UserContextProvider previewMode={previewMode}>
                                <Sdk
                                  renderMode={renderMode}
                                  previewMode={previewMode}
                                  environment={environment}
                                  {...sdkProps}
                                />
                              </UserContextProvider>
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

AppMain.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  // Space
  revision: PropTypes.number,
  webKey: PropTypes.string,
  environment: PropTypes.string,
  currentPageId: PropTypes.string,
  // Server
  server: PropTypes.object, // { graphqlServer, basePath, subscriptionServer, host, websocketServer }
  offlineMode: PropTypes.bool,
  offlineData: PropTypes.object, // { schema, style, plugins }
  offlineDataType: PropTypes.oneOf(['json', 'yaml']),
  // Extra
  sdkEnvironment: PropTypes.string,
  renderMode: PropTypes.oneOf([
    RENDER_MODE_IFRAME,
    RENDER_MODE_RAW,
    RENDER_MODE_SHADOW,
    RENDER_MODE_SSR,
    RENDER_MODE_WIDGET
  ]),
  sdkStylePath: PropTypes.string,
  previewMode: PropTypes.bool,
  externalStyle: PropTypes.string,
  state: PropTypes.object,
  onInitEventBridge: PropTypes.func,
  onInitStateManager: PropTypes.func
};

export default AppMain;
