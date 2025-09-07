import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import { use, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

const HistoryButtons = () => {
  const { eventBridge } = use(EventBridgeContext);
  const { canRedo, canUndo, undoableRedo, undoableUndo } = use(UndoableContext);

  const handleClickUndo = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetSelected', null);
    undoableUndo();
  }, [undoableUndo, eventBridge]);

  const handleClickRedo = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetSelected', null);
    undoableRedo();
  }, [undoableRedo, eventBridge]);

  return (
    <IconGroup className="h-8" size="md" gap={4}>
      <IconGroup.Icon
        icon="fa-solid fa-rotate-left"
        title="Undo"
        cursor="pointer"
        disabled={!canUndo}
        onClick={handleClickUndo}
      />
      <IconGroup.Icon
        icon="fa-solid fa-rotate-right"
        title="Redo"
        cursor="pointer"
        disabled={!canRedo}
        onClick={handleClickRedo}
      />
      <IconGroup.Separator />
      <IconGroup.Icon icon="fa-solid fa-clock-rotate-left" title="History" cursor="pointer" disabled />
    </IconGroup>
  );
};

export default HistoryButtons;
