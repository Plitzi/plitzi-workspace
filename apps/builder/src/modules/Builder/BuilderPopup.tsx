import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import StoreProvider from '@plitzi/sdk-shared/store/StoreProvider';
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

  const { definition } = segment;

  return (
    <div className="flex w-full grow">
      <StoreProvider value={segment}>
        <BuilderProvider
          schemaName={definition.name}
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
              />
            )}
          </PopupProvider>
        </BuilderProvider>
      </StoreProvider>
    </div>
  );
};

export default BuilderPopup;
