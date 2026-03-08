import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { generateID } from '@plitzi/sdk-shared';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import LayoutForm from '@pmodules/App/models/LayoutForm';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';
import PageForm from '@pmodules/App/models/PageForm';

import type { PageFolder } from '@plitzi/sdk-shared';

export type DirectoryHeaderProps = {
  pageFolders: PageFolder[];
};

const DirectoryHeader = ({ pageFolders }: DirectoryHeaderProps) => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);

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
      void eventBridge.emit('main', 'schemaAddPage', response);
    }
  }, [showModal, eventBridge, pageFolders]);

  const handleClickAddLayout = useCallback(async () => {
    const response = await showModal<{ name: string; pageFolder?: string }>(
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
      const { name, pageFolder } = response;
      const { definition, attributes } = componentDefinitions.current.layoutContainer;
      const id = generateID();
      const element = {
        id,
        attributes: { ...attributes, folder: pageFolder },
        definition: { ...definition, rootId: id, parentId: null, label: name }
      };
      void eventBridge.emit('main', 'schemaAddElement', '', element, 'custom');
    }
  }, [showModal, componentDefinitions, eventBridge]);

  const handleClickAddPageFolder = useCallback(async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Page Folder</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PageFolderForm pageFolders={pageFolders} onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      ),
      undefined,
      { size: 'sm' }
    );

    if (response) {
      void eventBridge.emit('main', 'schemaAddPageFolder', response);
    }
  }, [showModal, pageFolders, eventBridge]);

  return (
    <Flex items="center" justify="center" gap={2} className="border-b border-gray-200 pb-3">
      <Button
        intent="primary"
        size="sm"
        className="group h-8 grow basis-0"
        iconPlacement="before"
        onClick={handleClickAddPage}
      >
        <Button.Icon icon="fa-solid fa-file-circle-plus" size="md" className="text-base" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-25 group-hover:opacity-100">
          New Page
        </span>
      </Button>
      <Button
        intent="primary"
        size="sm"
        className="group h-8 grow basis-0"
        iconPlacement="before"
        onClick={handleClickAddLayout}
      >
        <Button.Icon icon="fa-solid fa-border-all" size="md" className="text-base" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-25 group-hover:opacity-100">
          New Layout
        </span>
      </Button>
      <Button
        intent="secondary"
        size="sm"
        className="group h-8 grow basis-0"
        iconPlacement="before"
        onClick={handleClickAddPageFolder}
      >
        <Button.Icon icon="fa-solid fa-folder-plus" size="md" className="text-base" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-25 group-hover:opacity-100">
          New Folder
        </span>
      </Button>
    </Flex>
  );
};

export default DirectoryHeader;
