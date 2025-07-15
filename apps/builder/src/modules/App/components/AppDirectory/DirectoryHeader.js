// Packages
import React, { useCallback, use } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';

// Alias
import PageForm from '@pmodules/App/models/PageForm';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';

const pageFoldersDefault = [];

/**
 * @param {{
 *   pageFolders?: any[];
 * }} props
 * @returns {React.ReactElement}
 */
const DirectoryHeader = props => {
  const { pageFolders = pageFoldersDefault } = props;
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);

  const handleClickAddPage = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Page</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PageForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      eventBridge.emit('main', EventBridgeTypes.SCHEMA_ADD_PAGE, response);
    }
  }, [showModal, eventBridge, pageFolders]);

  const handleClickAddPageFolder = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Page Folder</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PageFolderForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      eventBridge.emit('main', EventBridgeTypes.SCHEMA_ADD_PAGE_FOLDER, response);
    }
  }, [showModal, eventBridge]);

  return (
    <Flex items="center" justify="center" gap={2} className="border-b border-gray-200 pb-3">
      <Button intent="primary" size="sm" className="grow basis-0" iconPlacement="before" onClick={handleClickAddPage}>
        <Button.Icon icon="fa-solid fa-file-circle-plus" size="md" className="text-base" />
        New Page
      </Button>
      <Button
        intent="secondary"
        size="sm"
        className="grow basis-0"
        iconPlacement="before"
        onClick={handleClickAddPageFolder}
      >
        <Button.Icon icon="fa-solid fa-folder-plus" size="md" className="text-base" />
        New Folder
      </Button>
    </Flex>
  );
};

export default DirectoryHeader;
