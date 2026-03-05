import { ModalProvider } from '@plitzi/plitzi-ui/Modal';

import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
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
import UndoableContextProducer from '@pmodules/Undoable/UndoableContextProducer';

import type { Environment, Server, ServerEnvironment } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProviderProps = {
  children?: ReactNode;
  instanceId: string;
  webKey: string;
  webId: number;
  environment: Environment;
  builderEnvironment?: ServerEnvironment;
  userKey: string;
  server: Server;
  includeSubscriptions: boolean;
  includeRealTime: boolean;
  previewMode: boolean;
  debugMode?: boolean;
};

const AppProvider = ({
  children,
  instanceId,
  webKey = '',
  webId,
  environment = 'main',
  builderEnvironment = 'production',
  userKey = '',
  server,
  includeSubscriptions = true,
  includeRealTime = true,
  previewMode = false,
  debugMode = false
}: AppProviderProps) => {
  return (
    <NetworkContextProvider
      instanceId={instanceId}
      webKey={webKey}
      webId={webId}
      environment={environment}
      builderEnvironment={builderEnvironment}
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
                <CollectionContextProvider>
                  <PluginsContextProvider>
                    <ModalProvider>
                      <SchemaContextProvider includeSubscriptions={includeSubscriptions}>
                        <StyleContextProvider includeSubscriptions={includeSubscriptions}>
                          <AuthContextProvider previewMode={previewMode} environment={environment} server={server}>
                            <NavigationContextProvider previewMode={previewMode}>{children}</NavigationContextProvider>
                          </AuthContextProvider>
                        </StyleContextProvider>
                      </SchemaContextProvider>
                    </ModalProvider>
                  </PluginsContextProvider>
                </CollectionContextProvider>
              </SegmentsContextProvider>
            </EventBridgeContextProvider>
          </UndoableContextProducer>
        </QueueContextProvider>
      </NetworkSubscriptionsContextProvider>
    </NetworkContextProvider>
  );
};

export default AppProvider;
