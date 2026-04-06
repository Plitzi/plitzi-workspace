import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider } from '@plitzi/plitzi-ui/Popup';
import { useState, useMemo } from 'react';

import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';

import AppContainer from './AppContainer';
import AppContext from './AppContext';
import AppProvider from './AppProvider';

import type { AppContextValue } from './AppContext';
import type { DisplayMode, Environment, Server, ServerEnvironment, BuilderState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppMainProps = {
  webKey?: string;
  webId: number;
  userKey?: string;
  instanceId?: string;
  server: Server;
  environment?: Environment;
  builderEnvironment?: ServerEnvironment;
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
  builderEnvironment = 'production',
  includeSubscriptions = true,
  includeRealTime = true,
  externalStyle = '',
  state,
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
        builderEnvironment={builderEnvironment}
        userKey={userKey}
        server={server}
        includeSubscriptions={includeSubscriptions}
        includeRealTime={includeRealTime}
        previewMode={previewMode}
        debugMode={debugMode}
      >
        <StateManagerContextProvider webId={webId} state={state}>
          <DataSourceContextProvider environment={environment}>
            <InteractionsBuilderContextProvider previewMode={previewMode}>
              <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
                <AppContainer externalStyle={externalStyle} />
              </PopupProvider>
            </InteractionsBuilderContextProvider>
          </DataSourceContextProvider>
        </StateManagerContextProvider>
      </AppProvider>
    ),
    [
      instanceId,
      webKey,
      webId,
      environment,
      builderEnvironment,
      userKey,
      server,
      includeSubscriptions,
      includeRealTime,
      previewMode,
      debugMode,
      state,
      externalStyle
    ]
  );

  return <AppContext value={appValueMemo}>{childrenMemo}</AppContext>;
};

export default AppMain;
