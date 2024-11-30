// Packages
import React, { use, useCallback } from 'react';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import classNames from 'classnames';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import UndoableContext from '@pmodules/Undoable/UndoableContext';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const HistoryButtons = props => {
  const { className } = props;
  const { eventBridge } = use(EventBridgeContext);
  const { canRedo, canUndo, undoableRedo, undoableUndo } = use(UndoableContext);

  const handleClickUndo = useCallback(() => {
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    undoableUndo();
  }, [undoableUndo, eventBridge]);

  const handleClickRedo = useCallback(() => {
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    undoableRedo();
  }, [undoableRedo, eventBridge]);

  return (
    <IconGroup className={classNames('h-[26px]', className)} size="lg" gap={3}>
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
