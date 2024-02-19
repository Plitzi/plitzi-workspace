// Packages
import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';

// Alias
import PageForm from '@pmodules/App/models/PageForm';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';

const pageFoldersDefault = [];

const DirectoryHeader = props => {
  const { className = '', pageFolders = pageFoldersDefault } = props;
  const { showModal } = useModal();
  const { eventBridge } = useContext(EventBridgeContext);

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
    <div className={classNames('flex p-2 items-center justify-between border-b border-gray-300', className)}>
      <Heading type="h3" className="m-0">
        Pages
      </Heading>
      <div className="flex items-center gap-1">
        <Button
          intent="custom"
          size="sm"
          className="border border-gray-300 rounded"
          title="Add Folder"
          onClick={handleClickAddPageFolder}
        >
          <i className="fa-solid fa-folder-plus fa-2x" />
        </Button>
        <Button
          intent="custom"
          size="sm"
          className="border border-gray-300 rounded"
          title="Add Page"
          onClick={handleClickAddPage}
        >
          <i className="fa-solid fa-file-circle-plus fa-2x" />
        </Button>
      </div>
    </div>
  );
};

DirectoryHeader.propTypes = {
  className: PropTypes.string,
  pageFolders: PropTypes.array
};

export default DirectoryHeader;
