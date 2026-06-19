import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import CollectionContextProvider from '@modules/Collection/CollectionContextProvider';
import InteractionsSdkContextProvider from '@modules/Interactions/InteractionsSdkContextProvider';
import NavigationContextProvider from '@modules/Navigation/NavigationContextProvider';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import Sdk from '@modules/Sdk';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import { StoreContext } from '@plitzi/nexus/StoreContext';
import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import GlobalSources from '@plitzi/sdk-elements/dataSource/GlobalSources';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import SdkStyleContextProvider from '@plitzi/sdk-style/SdkStyleContextProvider';

import devtoolsCssUrl from '../../assets/plitzi-sdk-devtools.scss?url';
import styleUrl from '../../assets/plitzi-sdk.scss?url';

import type { StoreApi } from '@plitzi/nexus';
import type {
  Environment,
  Server,
  RenderMode,
  RuntimeStateInstance,
  EventBridgeContextValue,
  OfflineDataRaw,
  SdkState
} from '@plitzi/sdk-shared';

export type AppMainProps = {
  revision?: number;
  webKey?: string;
  webId: number;
  environment?: Environment;
  currentPageId?: string;
  server: Server;
  isHydrating?: boolean;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
  instanceId?: string;
  renderMode?: RenderMode;
  sdkStylePath?: string;
  sdkDevToolsStylePath?: string;
  previewMode?: boolean;
  debugMode?: boolean;
  state?: Record<string, unknown>;
  onInitStateManager?: (instance: RuntimeStateInstance) => void;
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
  offlineMode = false,
  offlineData,
  offlineDataType = 'json',
  // Extra
  instanceId,
  renderMode = 'iframe',
  sdkStylePath = './plitzi-sdk.css',
  sdkDevToolsStylePath = './plitzi-sdk-devtools.css',
  previewMode = true,
  debugMode = false,
  onInitEventBridge,
  onInitStateManager,
  ...sdkProps
}: AppMainProps) => {
  const store = use(StoreContext) as StoreApi<SdkState> | undefined;

  // Expose the imperative runtime-state handle to the host (consumed by `getStateManager()`). A nexus base-path view
  // binds every read/write to `runtime.state`, so call sites concatenate nothing and the updater form type-checks.
  const runtimeState = useMemo(() => store?.withBase('runtime.state'), [store]);
  const stateManager = useMemo<RuntimeStateInstance>(
    () => ({
      get state() {
        return runtimeState?.getState() ?? {};
      },
      setState: value => runtimeState?.setState(undefined, value),
      setStateByKey: (key, value) => runtimeState?.setState(key, value),
      clearState: () => runtimeState?.setState(undefined, {})
    }),
    [runtimeState]
  );

  useEffect(() => {
    onInitStateManager?.(stateManager);
  }, [onInitStateManager, stateManager]);

  return (
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
          <PluginsContextProvider renderMode={renderMode} sdkStylePath={styleUrl ? styleUrl : sdkStylePath}>
            <SdkStyleContextProvider>
              <EventBridgeContextProvider onInit={onInitEventBridge} debugMode={debugMode}>
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
                      <GlobalSources environment={environment}>
                        <InteractionsSdkContextProvider previewMode={previewMode}>
                          <DevToolsContainer
                            enabled={debugMode}
                            devToolsStyleLink={devtoolsCssUrl ? devtoolsCssUrl : sdkDevToolsStylePath}
                            renderMode="shadow"
                            innerClassName={clsx({ flex: renderMode === 'iframe' })}
                          >
                            <Sdk
                              renderMode={renderMode}
                              previewMode={previewMode}
                              debugMode={debugMode}
                              environment={environment}
                              isHydrating={isHydrating}
                              sdkStylePath={styleUrl ? styleUrl : sdkStylePath}
                              server={server}
                              {...sdkProps}
                            />
                          </DevToolsContainer>
                        </InteractionsSdkContextProvider>
                      </GlobalSources>
                    </NavigationContextProvider>
                  </AuthContextProvider>
                </SegmentsContextProvider>
              </EventBridgeContextProvider>
            </SdkStyleContextProvider>
          </PluginsContextProvider>
        </CollectionContextProvider>
      </SchemaContextProvider>
    </NetworkContextProvider>
  );
};

export default AppMain;
