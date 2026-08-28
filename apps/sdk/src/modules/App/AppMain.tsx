import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import { AnalyticsReporter } from '@modules/Analytics';
import NavigationProvider from '@modules/Navigation/NavigationProvider';
import NetworkContextProvider from '@modules/Network/NetworkContextProvider';
import PluginsContextProvider from '@modules/Plugins/PluginsContextProvider';
import SchemaContextProvider from '@modules/Schema/SchemaContextProvider';
import Sdk from '@modules/Sdk';
import SegmentsContextProvider from '@modules/Segments/SegmentsContextProvider';
import { StoreContext } from '@plitzi/nexus/react';
import AuthContextProvider from '@plitzi/sdk-auth/AuthContextProvider';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import GlobalSources from '@plitzi/sdk-elements/dataSource/GlobalSources';
import EventBridgeContextProvider from '@plitzi/sdk-event-bridge/EventBridgeContextProvider';
import InteractionsSourcesProvider from '@plitzi/sdk-interactions/InteractionsSourcesProvider';
import { DEFAULT_RENDER_SETTINGS, useSdkStoreSync } from '@plitzi/sdk-shared/store';
import SdkStyleContextProvider from '@plitzi/sdk-style/SdkStyleContextProvider';

import devtoolsCssUrl from '../../assets/plitzi-sdk-devtools.scss?url';
import styleUrl from '../../assets/plitzi-sdk.scss?url';

import type { StoreApi } from '@plitzi/nexus';
import type {
  AnalyticsConfig,
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
  branding?: boolean;
  /** Set by the server that metered this render: the account behind this space is over its quota. */
  overQuota?: boolean;
  analytics?: AnalyticsConfig;
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
  renderMode = DEFAULT_RENDER_SETTINGS.renderMode,
  sdkStylePath = './plitzi-sdk.css',
  sdkDevToolsStylePath,
  previewMode = true,
  debugMode = false,
  overQuota = false,
  analytics,
  onInitEventBridge,
  onInitStateManager,
  ...sdkProps
}: AppMainProps) => {
  const store = use(StoreContext) as StoreApi<SdkState> | undefined;

  // The surface this render happens on, published once for the whole tree. Every provider below used to take these as
  // props — five flags threaded through nine components — and they are read from the store instead.
  useSdkStoreSync(
    [
      'render.previewMode',
      'render.debugMode',
      'render.renderMode',
      'render.environment',
      'render.isHydrating',
      'render.overQuota'
    ],
    [previewMode, debugMode, renderMode, environment, isHydrating, overQuota]
  );

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
      revision={revision}
    >
      <SchemaContextProvider>
        <PluginsContextProvider sdkStylePath={styleUrl ? styleUrl : sdkStylePath}>
          <SdkStyleContextProvider>
            <EventBridgeContextProvider onInit={onInitEventBridge} debugMode={debugMode}>
              <SegmentsContextProvider>
                <AuthContextProvider server={server}>
                  <NavigationProvider currentPageId={currentPageId}>
                    <AnalyticsReporter analytics={analytics} />
                    <GlobalSources>
                      <InteractionsSourcesProvider>
                        <DevToolsContainer
                          enabled={debugMode}
                          instanceId={instanceId}
                          devToolsStyleLink={sdkDevToolsStylePath ? sdkDevToolsStylePath : devtoolsCssUrl}
                          renderMode="shadow"
                          innerClassName={clsx({ flex: renderMode === 'iframe' })}
                        >
                          <Sdk sdkStylePath={styleUrl ? styleUrl : sdkStylePath} server={server} {...sdkProps} />
                        </DevToolsContainer>
                      </InteractionsSourcesProvider>
                    </GlobalSources>
                  </NavigationProvider>
                </AuthContextProvider>
              </SegmentsContextProvider>
            </EventBridgeContextProvider>
          </SdkStyleContextProvider>
        </PluginsContextProvider>
      </SchemaContextProvider>
    </NetworkContextProvider>
  );
};

export default AppMain;
