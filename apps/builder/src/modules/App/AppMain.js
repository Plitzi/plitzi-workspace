// Packages
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
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

  return <AppContext.Provider value={appValueMemo}>{childrenMemo}</AppContext.Provider>;
};

AppMain.propTypes = {
  children: PropTypes.node,
  instanceId: PropTypes.string,
  webKey: PropTypes.string,
  webId: PropTypes.number,
  environment: PropTypes.string,
  userKey: PropTypes.string,
  server: PropTypes.object,
  includeSubscriptions: PropTypes.bool,
  includeRealTime: PropTypes.bool,
  externalStyle: PropTypes.string,
  state: PropTypes.object
};

export default AppMain;
