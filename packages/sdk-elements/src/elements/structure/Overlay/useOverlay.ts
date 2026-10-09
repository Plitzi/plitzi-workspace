import { use, useCallback, useEffect, useMemo, useState } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import { metadataOf } from './metadataOf';
import pathFields from '../../../dataSource/pathFields';
import sourceStore from '../../../dataSource/sourceStore';
import useElement from '../../../Element/hooks/useElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';

export type UseOverlayProps = {
  /** What it is called where it has no label of its own: `Modal`, `Dialog`. */
  name: string;
  sourceType: string;
  /** The callbacks it answers — `openModal` and `closeModal` — as its declaration has them. */
  callbacks: { open: InteractionCallback; close: InteractionCallback };
  /** The events it fires as it opens and closes — `onModalOpen`, `onModalClose`. */
  events: { open: string; close: string };
  /** Whether a click on the backdrop closes it. */
  autoHideAfterClick: boolean;
};

/**
 * What a modal and a dialog share: the data they were opened with, published to what is inside them as their source;
 * the callbacks that open and close them; and the events they fire as they do.
 */
const useOverlay = ({ name, sourceType, callbacks, events, autoHideAfterClick }: UseOverlayProps) => {
  const {
    id,
    rootId,
    visible,
    definition: { styleSelectors, label = name },
    elementState,
    setElementState
  } = useElement();
  const sourceName = getSourceName(sourceType, id);
  const {
    settings: { previewMode }
  } = usePlitzi();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  /** Fires one of its events, handed the data it was opened with. */
  const trigger = useCallback(
    (event: string) => interactionsManager.interactionTrigger(id, event, { metadata }),
    [id, interactionsManager, metadata]
  );

  const hide = useCallback(() => {
    setMetadata({});
    setElementState(state => ({ ...state, visibility: false }));
  }, [setElementState]);

  const open = useCallback(
    (params: InteractionCallbackParamValues) => {
      setMetadata(metadataOf(params.metadata));
      setElementState(state => ({ ...state, visibility: true }));
    },
    [setElementState]
  );

  const close = useCallback(() => {
    void trigger(events.close);
    hide();
  }, [events.close, hide, trigger]);

  const closeFromBackdrop = useCallback(() => {
    if (autoHideAfterClick) {
      close();
    }
  }, [autoHideAfterClick, close]);

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      [callbacks.open.action]: { ...callbacks.open, title: `Open ${label}`, callback: open },
      [callbacks.close.action]: { ...callbacks.close, title: `Close ${label}`, callback: close }
    }),
    [callbacks.close, callbacks.open, close, label, open]
  );

  useEffect(() => {
    if (elementState.visibility !== false) {
      void interactionsManager.interactionTrigger(id, events.open, { metadata });
    }
  }, [id, interactionsManager, metadata, elementState.visibility, events.open]);

  const sourceFields = useCallback(() => pathFields(metadata), [metadata]);

  useRegisterSource({ id, source: sourceName, name: label ? label : `${name} - ${id}`, fields: sourceFields });

  const storeValue = useMemo(() => sourceStore(sourceName, metadata), [sourceName, metadata]);

  return {
    id,
    titleId: `${rootId}_${id}_title`,
    styleSelectors,
    /** Shown, and on a rendered page — never in the builder, where it is something being edited. */
    open: Boolean(previewMode) && visible,
    interactionCallbacks,
    storeValue,
    trigger,
    hide,
    close,
    closeFromBackdrop
  };
};

export type Overlay = ReturnType<typeof useOverlay>;

export default useOverlay;
