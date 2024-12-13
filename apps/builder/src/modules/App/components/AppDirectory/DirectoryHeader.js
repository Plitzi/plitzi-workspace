// Packages
import React, { useCallback, use } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
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
      <Modal.Body>
        <PageForm pageFolders={pageFolders} />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const { data } = response;
      eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_ADD_PAGE, data);
    }
  }, [showModal, eventBridge, pageFolders]);

  const handleClickAddPageFolder = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Page Folder</h4>
      </Modal.Header>,
      <Modal.Body>
        <PageFolderForm pageFolders={pageFolders} />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const { data } = response;
      eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_ADD_PAGE_FOLDER, data);
    }
  }, [showModal, eventBridge]);

  return (
    <Flex items="center" justify="center" gap={2}>
      <Button
        intent="primary"
        size="sm"
        className="grow basis-0"
        content="New Page"
        iconPlacement="before"
        onClick={handleClickAddPage}
      >
        <Button.Icon icon="fa-solid fa-file-circle-plus" className="fa-2x" />
      </Button>
      <Button
        intent="secondary"
        size="sm"
        className="grow basis-0"
        content="New Folder"
        iconPlacement="before"
        onClick={handleClickAddPageFolder}
      >
        <Button.Icon icon="fa-solid fa-folder-plus" className="fa-2x" />
      </Button>
    </Flex>
  );
};

export default DirectoryHeader;
