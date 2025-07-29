import { ModalProvider } from '@plitzi/plitzi-ui/Modal';

import UserBaseContextProvider from '@plitzi/sdk-auth/UserBaseContextProvider';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import CollectionContextProvider from '@pmodules/Collection/CollectionContextProvider';
import NavigationContextProvider from '@pmodules/Navigation/NavigationContextProvider';
import NetworkContextProvider from '@pmodules/Network/NetworkContextProvider';
import NetworkSubscriptionsContextProvider from '@pmodules/Network/NetworkSubscriptionsContextProvider';
import PluginsContextProvider from '@pmodules/Plugins/PluginsContextProvider';
import QueueContextProvider from '@pmodules/Queue/QueueContextProvider';
import SchemaContextProvider from '@pmodules/Schema/SchemaContextProvider';
import SegmentsContextProvider from '@pmodules/Segments/SegmentsContextProvider';
import StyleContextProvider from '@pmodules/Style/StyleContextProvider';
import TemplatesContextProvider from '@pmodules/Templates/TemplatesContextProvider';
import UndoableContextProducer from '@pmodules/Undoable/UndoableContextProducer';

import type { ServerEnvironment } from '../../config';
import type { Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProviderProps = {
  children: ReactNode;
  instanceId: string;
  webKey: string;
  webId: string;
  environment: ServerEnvironment;
  userKey: string;
  server: Server;
  includeSubscriptions: boolean;
  includeRealTime: boolean;
  previewMode: boolean;
};

const AppProvider = ({
  children,
  instanceId,
  webKey = '',
  webId,
  environment = 'development',
  userKey = '',
  server,
  includeSubscriptions = true,
  includeRealTime = true,
  previewMode = false
}: AppProviderProps) => {
  return (
    <NetworkContextProvider
      instanceId={instanceId}
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

export default AppProvider;
