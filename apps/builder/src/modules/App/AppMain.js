// Packages
import React, { useState, useMemo } from 'react';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import UserContextProvider from '@plitzi/sdk-auth/UserContextProvider';

// Alias
import DataSourceBuilderContextProvider from '@pmodules/DataSource/DataSourceBuilderContextProvider';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';
import StateManagerContextProvider from '@pmodules/StateManager/StateManagerContextProvider';
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
    state
  } = props;
  const [previewMode, setPreviewMode] = useState(false);
  const [displayBorderComponents, setDisplayBorderComponents] = useState(DISPLAY_BORDER_BLACK);
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState('desktop');
  const [mobilePreview, setMobilePreview] = useState(false);

  const appValueMemo = useMemo(
    () => ({
      previewMode,
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
        <StateManagerContextProvider state={state}>
          <DataSourceBuilderContextProvider>
            <InteractionsBuilderContextProvider previewMode={previewMode}>
              <UserContextProvider previewMode={previewMode}>
                <PopupProvider renderRightPopup={false} renderFloatingPopup={!previewMode}>
                  <AppContainer externalStyle={externalStyle} />
                </PopupProvider>
              </UserContextProvider>
            </InteractionsBuilderContextProvider>
          </DataSourceBuilderContextProvider>
        </StateManagerContextProvider>
      </AppProvider>
    ),
    [props]
  );

  return <AppContext value={appValueMemo}>{childrenMemo}</AppContext>;
};

export default AppMain;
