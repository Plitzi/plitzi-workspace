import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import { use, useCallback } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import AppContext from '@pmodules/App/AppContext';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

const PreviewModeButtons = () => {
  const { eventBridge } = use(EventBridgeContext);
  const { previewMode, setPreviewMode } = use(AppContext);
  const queueProcessing = use(QueueStatusContext);

  const handleClickPreviewMode = useCallback(() => {
    void eventBridge.emit('builder', 'builderSetSelected', null);
    setPreviewMode(state => !state);
  }, [eventBridge, setPreviewMode]);

  return (
    <IconGroup gap={4}>
      <IconGroup.Icon
        icon={queueProcessing ? 'fas fa-sync fa-spin' : 'fas fa-check'}
        title="Mode: Desktop"
        intent="custom"
        className="text-green-500"
      />
      <IconGroup.Icon
        icon={previewMode ? 'fa-solid fa-pause' : 'fa-solid fa-play'}
        cursor="pointer"
        onClick={handleClickPreviewMode}
      />
    </IconGroup>
  );
};

export default PreviewModeButtons;
