// Packages
import React, { use, useCallback } from 'react';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';

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
    <div className={classNames('flex bg-gray-50 border border-gray-200 rounded', className)}>
      <Button
        intent="custom"
        className={classNames('hover:bg-gray-100 h-8 w-8 rounded', {
          'text-gray-400 cursor-not-allowed': !canUndo
        })}
        onClick={handleClickUndo}
        title="Undo"
      >
        <i className="fa-solid fa-rotate-left" />
      </Button>
      <Button
        intent="custom"
        className={classNames('hover:bg-gray-200 h-8 w-8 rounded', {
          'text-gray-400 cursor-not-allowed': !canRedo
        })}
        onClick={handleClickRedo}
        title="Redo"
      >
        <i className="fa-solid fa-rotate-right" />
      </Button>
      <Button
        intent="custom"
        className={classNames('hover:bg-gray-200 h-8 w-8 rounded', {
          'text-gray-400 cursor-not-allowed': true
        })}
        // onClick={handleClickRedo}
        disabled
        title="History"
      >
        <i className="fa-solid fa-clock-rotate-left" />
      </Button>
    </div>
  );
};

export default HistoryButtons;
