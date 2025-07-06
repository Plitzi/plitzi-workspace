// Packages
import React, { useCallback, use, useMemo } from 'react';
import PopupSidePanel from '@plitzi/plitzi-ui/Popup/PopupSidePanel';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import PopupProvider from '@plitzi/plitzi-ui/Popup/PopupProvider';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import Builder from '@pmodules/Builder';
import BuilderProvider, { BUILDER_MODE_SEGMENT } from '@pmodules/Builder/BuilderProvider';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

/**
 * @param {{
 *   previewMode?: boolean;
 *   segmentIdentifier?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderPopup = props => {
  const { previewMode = false, segmentIdentifier = '' } = props;
  const { eventBridge } = use(EventBridgeContext);
  const { segments } = use(SegmentsContext);
  const segment = segments[segmentIdentifier];
  const [popupsActiveRught, setPopupsActiveRight] = useStorage('builder-state.popupSidePanel.popupsActive.right', []); // <string[]>

  const handleChange = useCallback(
    popups => setPopupsActiveRight(popups, 'PopupSidePanel.popupsActive.right'),
    [setPopupsActiveRight]
  );

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.SEGMENT, event, segment.id, ...data),
    [eventBridge, segment?.id]
  );

  if (!segment) {
    return (
      <div className="flex h-full items-center justify-center">
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
        <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
          <Builder previewMode={previewMode} />

          {!previewMode && (
            <PopupSidePanel
              className="max-h-[calc(_100vh_-_48px)] overflow-y-auto"
              placementTabs="right"
              minWidth={320}
              maxWidth={540}
              canHide
              multi
              value={popupsActiveRught}
              onChange={handleChange}
            />
          )}
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

export default BuilderPopup;
