import { PopupProvider, PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import StoreProvider from '@plitzi/sdk-shared/store/StoreProvider';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import Builder from '@pmodules/Builder';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';

import type { BuilderState, EventBridgeEvent, Segment } from '@plitzi/sdk-shared';

export type BuilderPopupProps = {
  previewMode?: boolean;
  segmentIdentifier?: string;
};

const BuilderPopup = ({ previewMode = false, segmentIdentifier = '' }: BuilderPopupProps) => {
  const { eventBridge } = use(EventBridgeContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [segments] = useStore('segments');
  const segment = segments[segmentIdentifier] as Segment | undefined;

  const generateStoreState = useCallback(
    (currentState: BuilderState) => ({
      ...currentState,
      schema: { ...currentState.schema, ...segment?.schema },
      style: segment?.style ?? EMPTY_STYLE_SCHEMA
    }),
    [segment]
  );

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
      <StoreProvider value={generateStoreState} inherit>
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
