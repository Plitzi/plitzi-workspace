import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider } from '@plitzi/plitzi-ui/Popup';
import { useState, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import DevToolsContainer from '@plitzi/sdk-dev-tools/DevToolsContainer';
import GlobalSources from '@plitzi/sdk-elements/dataSource/GlobalSources';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';

import AppContainer from './AppContainer';
import AppContext from './AppContext';
import AppProvider from './AppProvider';

import type { AppContextValue } from './AppContext';
import type { DisplayMode, Environment, Server, BuilderState } from '@plitzi/sdk-shared';
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
  debugMode = false
}: AppMainProps) => {
  const [previewMode, setPreviewMode] = useState(false);
  const [displayBorderComponents, setDisplayBorderComponents] = useStorage<AppContextValue['displayBorderComponents']>(
    'builder-state.app.displayBorderComponents',
    'black'
  );
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [mobilePreview, setMobilePreview] = useState(false);
  const { useStoreSync } = createStoreHook<BuilderState>();
  useStoreSync('displayMode', displayMode);

  const appValueMemo = useMemo(
    () => ({
      previewMode,
      debugMode,
      setPreviewMode,
      displayBorderComponents,
      setDisplayBorderComponents,
      zoom,
      setZoom,
      displayMode,
      setDisplayMode,
      mobilePreview,
      setMobilePreview
    }),
    [
      previewMode,
      debugMode,
      setPreviewMode,
      displayBorderComponents,
      setDisplayBorderComponents,
      zoom,
      setZoom,
      displayMode,
      setDisplayMode,
      mobilePreview,
      setMobilePreview
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
        previewMode={previewMode}
        debugMode={debugMode}
      >
        <GlobalSources environment={environment}>
          <InteractionsBuilderContextProvider previewMode={previewMode}>
            <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
              <DevToolsContainer innerClassName="flex" enabled={debugMode}>
                <AppContainer externalStyle={externalStyle} />
              </DevToolsContainer>
            </PopupProvider>
          </InteractionsBuilderContextProvider>
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
