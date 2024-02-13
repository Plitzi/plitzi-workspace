// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import PopupSidebar from '@plitzi/plitzi-ui-components/Popup/PopupSidebar';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Alias
import Builder from '@pmodules/Builder';
import BuilderProvider, { BUILDER_MODE_SEGMENT } from '@pmodules/Builder/BuilderProvider';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';
import EventBridgeContext from '@pmodules/EventBridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@pmodules/EventBridge/EventBridgeHelper';

const BuilderPopup = props => {
  const { previewMode = false, segmentIdentifier = '' } = props;
  const { eventBridge } = useContext(EventBridgeContext);
  const { segments } = useContext(SegmentsContext);
  const segment = segments[segmentIdentifier];
  const [state, setCache, getCacheByKey] = useCache();
  const popupsActive = useMemo(() => getCacheByKey('PopupSidebar.popupsActive', []), [state]);

  const handleClickSelect = useCallback((popupId, popups) => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const handleLoadPopups = useCallback(popups => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.SEGMENT, event, segment.id, ...data),
    [eventBridge, segment?.id]
  );

  if (!segment) {
    return (
      <div className="h-full flex items-center justify-center">
        The segment is not available, please close this window
      </div>
    );
  }

  const { schema, style, definition } = segment;

  return (
    <div className="flex w-full grow">
      <BuilderProvider
        schemaName={definition?.name}
        schema={schema}
        style={style}
        baseElementId={definition?.baseElementId}
        mode={BUILDER_MODE_SEGMENT}
        onHandler={builderHandler}
      >
        <PopupProvider renderRightPopup={false} renderFloatingPopup={!previewMode}>
          <Builder previewMode={previewMode} />

          {!previewMode && (
            <PopupSidebar
              className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
              placementTabs="right"
              minWidth={320}
              maxWidth={540}
              canHide
              multiSelect
              popupsActive={popupsActive}
              onSelect={handleClickSelect}
              onLoadPopups={handleLoadPopups}
            />
          )}
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

BuilderPopup.propTypes = {
  previewMode: PropTypes.bool,
  segmentIdentifier: PropTypes.string
};

export default BuilderPopup;
