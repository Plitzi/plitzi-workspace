// Packages
import React from 'react';
import { withApollo } from '@apollo/client/react/hoc';
import ModalProvider from '@plitzi/plitzi-ui-components/Modal/ModalProvider';

// Monorepo
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';

// Alias
import NetworkSubscriptionsContextProvider from '@pmodules/Network/NetworkSubscriptionsContextProvider';
import NetworkContextProvider from '@pmodules/Network/NetworkContextProvider';
import QueueContextProvider from '@pmodules/Queue/QueueContextProvider';
import UndoableContextProducer from '@pmodules/Undoable/UndoableContextProducer';
import CollectionContextProvider from '@pmodules/Collection/CollectionContextProvider';
import PluginsContextProvider from '@pmodules/Plugins/PluginsContextProvider';
import TemplatesContextProvider from '@pmodules/Templates/TemplatesContextProvider';
import SegmentsContextProvider from '@pmodules/Segments/SegmentsContextProvider';
import SchemaContextProvider from '@pmodules/Schema/SchemaContextProvider';
import NavigationContextProvider from '@pmodules/Navigation/NavigationContextProvider';
import StyleContextProvider from '@pmodules/Style/StyleContextProvider';

/**
 * @param {{
 *   children: React.ReactNode;
 *   instanceId: string;
 *   webKey: string;
 *   webId: number;
 *   environment: string;
 *   userKey: string;
 *   server: object;
 *   includeSubscriptions: boolean;
 *   includeRealTime: boolean;
 *   previewMode: boolean;
 *   client: object;
 * }} props
 * @returns {React.ReactElement}
 */

const AppProvider = props => {
  const {
    children,
    instanceId,
    webKey = '',
    webId = 0,
    environment = 'development',
    userKey = '',
    server,
    includeSubscriptions = true,
    includeRealTime = true,
    client, // hocs
    previewMode = false
  } = props;

  return (
    <NetworkContextProvider
      instanceId={instanceId}
      client={client}
      webKey={webKey}
      webId={webId}
      environment={environment}
      userKey={userKey}
      server={server}
    >
      <NetworkSubscriptionsContextProvider
        includeSubscriptions={includeSubscriptions}
        includeRealTime={includeRealTime}
      >
        <QueueContextProvider includeSubscriptions={includeSubscriptions}>
          <UndoableContextProducer>
            <EventBridgeContextProvider>
              <SegmentsContextProvider>
                <TemplatesContextProvider>
                  <CollectionContextProvider>
                    <PluginsContextProvider>
                      <ModalProvider>
                        <SchemaContextProvider includeSubscriptions={includeSubscriptions}>
                          <StyleContextProvider includeSubscriptions={includeSubscriptions}>
                            <UserBaseContextProvider previewMode={previewMode} webId={webId} environment={environment}>
                              <NavigationContextProvider previewMode={previewMode}>
                                {children}
                              </NavigationContextProvider>
                            </UserBaseContextProvider>
                          </StyleContextProvider>
                        </SchemaContextProvider>
                      </ModalProvider>
                    </PluginsContextProvider>
                  </CollectionContextProvider>
                </TemplatesContextProvider>
              </SegmentsContextProvider>
            </EventBridgeContextProvider>
          </UndoableContextProducer>
        </QueueContextProvider>
      </NetworkSubscriptionsContextProvider>
    </NetworkContextProvider>
  );
};

export default withApollo(AppProvider);
