import { ModalProvider } from '@plitzi/plitzi-ui/Modal';

import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import ActionsContextProvider from '@pmodules/Actions/ActionsContextProvider';
import ConnectorsContextProvider from '@pmodules/Connectors/ConnectorsContextProvider';
import NavigationProvider from '@pmodules/Navigation/NavigationProvider';
import NetworkContextProvider from '@pmodules/Network/NetworkContextProvider';
import NetworkSubscriptionsContextProvider from '@pmodules/Network/NetworkSubscriptionsContextProvider';
import PluginsContextProvider from '@pmodules/Plugins/PluginsContextProvider';
import QueueContextProvider from '@pmodules/Queue/QueueContextProvider';
import SchemaContextProvider from '@pmodules/Schema/SchemaContextProvider';
import SegmentsContextProvider from '@pmodules/Segments/SegmentsContextProvider';
import StyleContextProvider from '@pmodules/Style/StyleContextProvider';
import UndoableContextProducer from '@pmodules/Undoable/UndoableContextProducer';

import type { Environment, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProviderProps = {
  children?: ReactNode;
  instanceId: string;
  webKey: string;
  webId: number;
  environment: Environment;
  userKey: string;
  server: Server;
  includeSubscriptions: boolean;
  includeRealTime: boolean;
  debugMode?: boolean;
};

const AppProvider = ({
  children,
  instanceId,
  webKey = '',
  webId,
  environment = 'main',
  userKey = '',
  server,
  includeSubscriptions = true,
  includeRealTime = true,
  debugMode = false
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
            <EventBridgeContextProvider debugMode={debugMode}>
              <SegmentsContextProvider>
                <ConnectorsContextProvider>
                  <ActionsContextProvider>
                    <PluginsContextProvider>
                      <ModalProvider>
                        <SchemaContextProvider includeSubscriptions={includeSubscriptions}>
                          <StyleContextProvider includeSubscriptions={includeSubscriptions}>
                            <AuthContextProvider server={server}>
                              <NavigationProvider>{children}</NavigationProvider>
                            </AuthContextProvider>
                          </StyleContextProvider>
                        </SchemaContextProvider>
                      </ModalProvider>
                    </PluginsContextProvider>
                  </ActionsContextProvider>
                </ConnectorsContextProvider>
              </SegmentsContextProvider>
            </EventBridgeContextProvider>
          </UndoableContextProducer>
        </QueueContextProvider>
      </NetworkSubscriptionsContextProvider>
    </NetworkContextProvider>
  );
};

export default AppProvider;
