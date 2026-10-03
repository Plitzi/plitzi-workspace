import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { documentIds } from '@plitzi/sdk-schema/helpers/components';
import { slugifyElementId, uniqueElementId } from '@plitzi/sdk-schema/helpers/elementId';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import LayoutForm from '@pmodules/App/models/LayoutForm';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';
import PageForm from '@pmodules/App/models/PageForm';

import useSitemapOpen from '../../hooks/useSitemapOpen';

import type { PageFolder } from '@plitzi/sdk-shared';

export type DirectoryHeaderProps = {
  pageFolders: PageFolder[];
};

const DirectoryHeader = ({ pageFolders }: DirectoryHeaderProps) => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { componentDefinitions } = use(ComponentContext);
  const getSchema = useBuilderStoreGetter('schema');
  const [sitemapOpen, setSitemapOpen] = useSitemapOpen();

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
      // Named after what the author called it, so the layout a page points at reads as that layout — free in every
      // tree, since a component's elements share the namespace.
      const taken = documentIds(getSchema());
      const id = uniqueElementId(slugifyElementId(name) || 'layout', candidate => taken.has(candidate));
      const element = {
        id,
        attributes: { ...attributes, folder: pageFolder },
        definition: { ...definition, rootId: id, parentId: null, label: name }
      };
      void eventBridge.emit('main', 'schemaAddElement', '', element, 'custom');
    }
  }, [showModal, componentDefinitions, eventBridge, getSchema]);

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

  const handleClickSitemap = useCallback(() => setSitemapOpen(open => !open), [setSitemapOpen]);

  const sitemapIcon = sitemapOpen ? 'fa-solid fa-pen-ruler' : 'fa-solid fa-sitemap';
  const sitemapTitle = sitemapOpen ? 'Back to the canvas' : 'See the pages as a map';

  return (
    <Flex items="center" justify="center" gap={2} className="border-b border-gray-200 pb-3 dark:border-zinc-700">
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
      {/* A way of looking at the pages, not something made: an icon apart from the three that create, which widen to
          their label on hover — a fourth would push the row past the panel. */}
      <Button
        intent="secondary"
        size="sm"
        className="h-8 w-8 shrink-0"
        title={sitemapTitle}
        onClick={handleClickSitemap}
      >
        <Button.Icon icon={sitemapIcon} size="md" className="text-base" />
      </Button>
    </Flex>
  );
};

export default DirectoryHeader;
