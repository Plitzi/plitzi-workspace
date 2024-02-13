// Packages
import React from 'react';
import PropTypes from 'prop-types';
import { withApollo } from '@apollo/client/react/hoc';
import ModalProvider from '@plitzi/plitzi-ui-components/Modal/ModalProvider';

// Alias
import NetworkSubscriptionsContextProvider from '@pmodules/Network/NetworkSubscriptionsContextProvider';
import NetworkContextProvider from '@pmodules/Network/NetworkContextProvider';
import QueueContextProvider from '@pmodules/Queue/QueueContextProvider';
import UndoableContextProducer from '@pmodules/Undoable/UndoableContextProducer';
import EventBridgeContextProvider from '@pmodules/EventBridge/EventBridgeContextProvider';
import CollectionContextProvider from '@pmodules/Collection/CollectionContextProvider';
import PluginsContextProvider from '@pmodules/Plugins/PluginsContextProvider';
import TemplatesContextProvider from '@pmodules/Templates/TemplatesContextProvider';
import SegmentsContextProvider from '@pmodules/Segments/SegmentsContextProvider';
import UserBaseContextProvider from '@pmodules/User/UserBaseContextProvider';
import SchemaContextProvider from '@pmodules/Schema/SchemaContextProvider';
import NavigationContextProvider from '@pmodules/Navigation/NavigationContextProvider';
import StyleContextProvider from '@pmodules/Style/StyleContextProvider';

const AppProvider = props => {
  const {
    children,
    instanceId,
    webKey = '',
    environment = 'development',
    userKey = '',
    server,
    includeSubscriptions = true,
    includeRealTime = true,
    client,
    previewMode = false
  } = props;

  return (
    <NetworkContextProvider
      instanceId={instanceId}
      client={client}
      webKey={webKey}
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
                            <UserBaseContextProvider previewMode={previewMode}>
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

AppProvider.propTypes = {
  children: PropTypes.node,
  instanceId: PropTypes.string,
  webKey: PropTypes.string,
  environment: PropTypes.string,
  userKey: PropTypes.string,
  server: PropTypes.object,
  includeSubscriptions: PropTypes.bool,
  includeRealTime: PropTypes.bool,
  previewMode: PropTypes.bool,
  // hocs
  client: PropTypes.object
};

export default withApollo(AppProvider);
