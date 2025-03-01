// Packages
import React, { useCallback, use } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
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
      <Modal.Body>
        <LayoutForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const { data } = response;
      const { definition, attributes } = componentDefinitions.layoutContainer;
      const id = generateID();
      const element = { id, attributes, definition: { ...definition, rootId: id, parentId: null, label: data.name } };
      eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_ADD_ELEMENT, '', element, 'custom');
    }
  }, [showModal, eventBridge]);

  // const handleClickAddPageFolder = useCallback(async () => {
  //   const response = await showModal(
  //     <Modal.Header>
  //       <h4>Add Page Folder</h4>
  //     </Modal.Header>,
  //     <Modal.Body>
  //       <PageFolderForm />
  //     </Modal.Body>,
  //     null,
  //     { placement: 'center', renderFooter: false }
  //   );

  //   if (response.result) {
  //     const { data } = response;
  //     eventBridge.emit(EventBridgeModuleTypes.MAIN, EventBridgeTypes.SCHEMA_ADD_PAGE_FOLDER, data);
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
