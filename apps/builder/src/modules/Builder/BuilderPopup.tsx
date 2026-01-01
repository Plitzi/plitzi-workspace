import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import Builder from '@pmodules/Builder';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';

import type { EventBridgeEvent, Segment } from '@plitzi/sdk-shared';

export type BuilderPopupProps = {
  previewMode?: boolean;
  segmentIdentifier?: string;
};

const BuilderPopup = ({ previewMode = false, segmentIdentifier = '' }: BuilderPopupProps) => {
  const { eventBridge } = use(EventBridgeContext);
  const { segments } = use(SegmentsContext);
  const segment = segments[segmentIdentifier] as Segment | undefined;
  const [popupsActiveRught, setPopupsActiveRight] = useStorage<string[]>(
    'builder-state.popupSidePanel.popupsActive.right',
    []
  );

  const handleChange = useCallback((popups: string[]) => setPopupsActiveRight(popups), [setPopupsActiveRight]);

  const builderHandler = useCallback(
    (event: EventBridgeEvent, data: unknown[]): void => void eventBridge.emit('segment', event, segment?.id, ...data),
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
        schemaName={definition.name}
        schema={schema}
        style={style}
        baseElementId={definition.baseElementId}
        mode="segment"
        onHandler={builderHandler}
      >
        <PopupProvider renderLeftPopup={false} renderRightPopup={false} renderFloatingPopup={!previewMode}>
          <Builder />

          {!previewMode && (
            <PopupSidePanel
              className="max-h-[calc(100vh-48px)] overflow-y-auto"
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
