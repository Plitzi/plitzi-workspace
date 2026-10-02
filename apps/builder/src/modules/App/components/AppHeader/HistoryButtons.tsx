import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import History from '@pmodules/History';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import { FORM_MODAL } from '../../helpers/modalSizes';

const HistoryButtons = () => {
  const { eventBridge } = use(EventBridgeContext);
  const { canRedo, canUndo, undoableRedo, undoableUndo } = use(UndoableContext);
  const { showModal } = useModal();

  const handleClickUndo = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetSelected', null);
    undoableUndo();
  }, [undoableUndo, eventBridge]);

  const handleClickRedo = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetSelected', null);
    undoableRedo();
  }, [undoableRedo, eventBridge]);

  // Beside undo and redo: this session's steps are those two, and every save the space ever had is this one.
  const handleClickHistory = useCallback(async () => {
    await showModal(
      <Modal.Header>
        <h4>History</h4>
      </Modal.Header>,
      ({ onClose }) => (
        <Modal.Body>
          <div className="flex h-[70vh] flex-col">
            <History onDismiss={onClose} />
          </div>
        </Modal.Body>
      ),
      undefined,
      FORM_MODAL
    );
  }, [showModal]);

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
      <IconGroup.Icon
        icon="fa-solid fa-clock-rotate-left"
        title="History"
        cursor="pointer"
        onClick={handleClickHistory}
      />
    </IconGroup>
  );
};

export default HistoryButtons;
