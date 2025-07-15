import { PopupProvider } from '@plitzi/plitzi-ui/Popup';
import { useState, useMemo } from 'react';

import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';

import AppContainer from './AppContainer';
import AppContext from './AppContext';
import AppProvider from './AppProvider';

import type { AppContextValue } from './AppContext';
import type { ReactNode } from 'react';

export type AppMainProps = {
  webKey?: string;
  webId?: string;
  userKey?: string;
  instanceId?: string;
  server?: object;
  environment?: string;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
  externalStyle?: string;
  state?: Record<string, unknown>;
  children?: ReactNode;
  debugMode?: boolean;
};

const AppMain = ({
  webKey = '',
  webId = '0',
  userKey = '',
  instanceId = '',
  server,
  environment = 'development',
  includeSubscriptions = true,
  includeRealTime = true,
  externalStyle = '',
  state,
  debugMode = false
}: AppMainProps) => {
  const [previewMode, setPreviewMode] = useState(false);
  const [displayBorderComponents, setDisplayBorderComponents] =
    useState<AppContextValue['displayBorderComponents']>('black');
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<AppContextValue['displayMode']>('desktop');
  const [mobilePreview, setMobilePreview] = useState(false);

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
      environment,
      externalStyle,
      includeRealTime,
      includeSubscriptions,
      instanceId,
      previewMode,
      server,
      state,
      userKey,
      webId,
      webKey
    ]
  );

  return <AppContext value={appValueMemo}>{childrenMemo}</AppContext>;
};

export default AppMain;
