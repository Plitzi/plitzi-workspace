// Packages
import React, { useCallback, use } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';

// Monorepo
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';

// Alias
import LayoutForm from '@pmodules/App/models/LayoutForm';

// Relatives
import { generateID } from '../../../../helpers/utils';

/**
 * @param {{
 *   pageFolders?: any[];
 * }} props
 * @returns {React.ReactElement}
 */
const LayoutsHeader = () => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);

  const handleClickAddLayout = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Layout</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <LayoutForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name } = response;
      const { definition, attributes } = componentDefinitions.layoutContainer;
      const id = generateID();
      const element = { id, attributes, definition: { ...definition, rootId: id, parentId: null, label: name } };
      eventBridge.emit('main', EventBridgeTypes.SCHEMA_ADD_ELEMENT, '', element, 'custom');
    }
  }, [showModal, eventBridge]);

  // const handleClickAddPageFolder = useCallback(async () => {
  //   const response = await showModal(
  //     <Modal.Header>
  //       <h4>Add Page Folder</h4>
  //     </Modal.Header>,
  //     ({ onSubmit, onClose }) => (
  //       <Modal.Body>
  //         <PageFolderForm onSubmit={onSubmit} onClose={onClose} />
  //       </Modal.Body>
  //     )
  //   );

  //   if (response) {
  //     eventBridge.emit('main', EventBridgeTypes.SCHEMA_ADD_PAGE_FOLDER, response);
  //   }
  // }, [showModal, eventBridge]);

  return (
    <Flex items="center" justify="center" gap={2} className="border-b border-gray-200 pb-3">
      <Button intent="primary" size="sm" className="grow basis-0" iconPlacement="before" onClick={handleClickAddLayout}>
        <Button.Icon icon="fa-solid fa-border-all" size="md" className="text-base" />
        New Layout
      </Button>
      {/* <Button
        intent="secondary"
        size="sm"
        className="grow basis-0"
        content="New Folder"
        iconPlacement="before"
        onClick={handleClickAddPageFolder}
      >
        <Button.Icon icon="fa-solid fa-folder-plus" className="fa-2x" />
      </Button> */}
    </Flex>
  );
};

export default LayoutsHeader;
