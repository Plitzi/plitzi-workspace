import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useState, useMemo } from 'react';

import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import GlobalSources from '@plitzi/sdk-elements/dataSource/GlobalSources';
import InteractionsSourcesProvider from '@plitzi/sdk-interactions/InteractionsSourcesProvider';
import { useBuilderStoreSync } from '@plitzi/sdk-shared/store';

import AppContainer from './AppContainer';
import AppContext from './AppContext';
import AppProvider from './AppProvider';

import type { AppContextValue } from './AppContext';
import type { DisplayMode, Environment, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppMainProps = {
  webKey?: string;
  webId: number;
  userKey?: string;
  instanceId?: string;
  server: Server;
  environment?: Environment;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
  externalStyle?: string;
  state?: Record<string, unknown>;
  children?: ReactNode;
  debugMode?: boolean;
  functionsWorkerUrl?: string;
  sdkIconsStylePath?: string;
};

const AppMain = ({
  webKey = '',
  webId,
  userKey = '',
  instanceId = '',
  server,
  environment = 'main',
  includeSubscriptions = true,
  includeRealTime = true,
  externalStyle = '',
  debugMode = false,
  functionsWorkerUrl = '',
  sdkIconsStylePath = ''
}: AppMainProps) => {
  const [previewMode, setPreviewMode] = useState(false);
  const [displayBorderComponents, setDisplayBorderComponents] = useStorage<AppContextValue['displayBorderComponents']>(
    'builder-state.app.displayBorderComponents',
    'black'
  );
  const [displayGrid, setDisplayGrid] = useStorage<boolean>('builder-state.app.displayGrid', false);
  const [motionPlaying, setMotionPlaying] = useState(false);
  const [motionReplays, setMotionReplays] = useState(0);
  const replayMotion = useCallback(() => {
    setMotionPlaying(true);
    setMotionReplays(count => count + 1);
  }, []);
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [mobilePreview, setMobilePreview] = useState(false);
  useBuilderStoreSync('displayMode', displayMode);
  // The surface this render happens on, published for the whole tree — the shared providers (auth, navigation,
  // global sources, interactions) read it from here instead of taking it as props from each surface that mounts them.
  useBuilderStoreSync(
    ['render.previewMode', 'render.debugMode', 'render.environment'],
    [previewMode, debugMode, environment]
  );

  const appValueMemo = useMemo(
    () => ({
      previewMode,
      debugMode,
      setPreviewMode,
      displayBorderComponents,
      setDisplayBorderComponents,
      displayGrid,
      setDisplayGrid,
      motionPlaying,
      setMotionPlaying,
      motionReplays,
      replayMotion,
      zoom,
      setZoom,
      displayMode,
      setDisplayMode,
      mobilePreview,
      setMobilePreview,
      functionsWorkerUrl,
      sdkIconsStylePath
    }),
    [
      previewMode,
      debugMode,
      setPreviewMode,
      displayBorderComponents,
      setDisplayBorderComponents,
      displayGrid,
      setDisplayGrid,
      motionPlaying,
      setMotionPlaying,
      motionReplays,
      replayMotion,
      zoom,
      setZoom,
      displayMode,
      setDisplayMode,
      mobilePreview,
      setMobilePreview,
      functionsWorkerUrl,
      sdkIconsStylePath
    ]
  );

  const childrenMemo = useMemo(
    () => (
      <AppProvider
        instanceId={instanceId}
        webKey={webKey}
        webId={webId}
        environment={environment}
        userKey={userKey}
        server={server}
        includeSubscriptions={includeSubscriptions}
        includeRealTime={includeRealTime}
        debugMode={debugMode}
      >
        <GlobalSources>
          <InteractionsSourcesProvider>
            <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
              <DevToolsContainer innerClassName="flex" enabled={debugMode} instanceId={instanceId}>
                <AppContainer externalStyle={externalStyle} />
              </DevToolsContainer>
            </PopupProvider>
          </InteractionsSourcesProvider>
        </GlobalSources>
      </AppProvider>
    ),
    [
      instanceId,
      webKey,
      webId,
      environment,
      userKey,
      server,
      includeSubscriptions,
      includeRealTime,
      previewMode,
      debugMode,
      externalStyle
    ]
  );

  return <AppContext value={appValueMemo}>{childrenMemo}</AppContext>;
};

export default AppMain;
