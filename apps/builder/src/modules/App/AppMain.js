// Packages
import React, { useState, useMemo } from 'react';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import StateManagerContextProvider from '@plitzi/sdk-state/StateManagerContextProvider';

// Alias
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';
import { DISPLAY_BORDER_BLACK } from '@pmodules/Builder/BuilderHelper';

// Relatives
import AppContext from './AppContext';
import AppProvider from './AppProvider';
import AppContainer from './AppContainer';

/**
 * @param {{
 *   webKey?: string;
 *   webId?: number;
 *   userKey?: string;
 *   instanceId?: string;
 *   server?: object;
 *   environment?: string;
 *   includeSubscriptions?: boolean;
 *   includeRealTime?: boolean;
 *   externalStyle?: string;
 *   state?: object;
 *   children?: React.ReactNode;
 *   debugMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const AppMain = props => {
  const {
    webKey = '',
    webId = 0,
    userKey = '',
    instanceId = '',
    server,
    environment = 'development',
    includeSubscriptions = true,
    includeRealTime = true,
    externalStyle = '',
    state,
    debugMode = false
  } = props;
  const [previewMode, setPreviewMode] = useState(false);
  const [displayBorderComponents, setDisplayBorderComponents] = useState(DISPLAY_BORDER_BLACK);
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState('desktop');
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
              <PopupProvider renderRightPopup={false} renderFloatingPopup={!previewMode}>
                <AppContainer externalStyle={externalStyle} />
              </PopupProvider>
            </InteractionsBuilderContextProvider>
          </DataSourceContextProvider>
        </StateManagerContextProvider>
      </AppProvider>
    ),
    [props]
  );

  return <AppContext value={appValueMemo}>{childrenMemo}</AppContext>;
};

export default AppMain;
