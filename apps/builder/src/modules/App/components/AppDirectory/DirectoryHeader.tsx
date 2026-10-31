import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { documentIds, slugifyElementId, uniqueElementId } from '@plitzi/sdk-schema';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import PanelToolbar from '@pmodules/App/components/PanelToolbar';
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
        <h4>New page</h4>
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
        <h4>New layout</h4>
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
        <h4>New folder</h4>
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
    <div className="flex flex-col gap-2 border-b border-gray-300 pb-3 dark:border-zinc-700">
      <PanelToolbar action={{ label: 'New page', onClick: () => void handleClickAddPage() }} />
      <div className="flex gap-2">
        <Button
          intent="secondary"
          size="xs"
          className="grow basis-0"
          iconPlacement="before"
          onClick={handleClickAddLayout}
        >
          <Button.Icon icon="fa-solid fa-border-all" />
          New layout
        </Button>
        <Button
          intent="secondary"
          size="xs"
          className="grow basis-0"
          iconPlacement="before"
          onClick={handleClickAddPageFolder}
        >
          <Button.Icon icon="fa-solid fa-folder-plus" />
          New folder
        </Button>
        {/* A way of looking at the pages, not something made: an icon apart from what creates. */}
        <Button intent="secondary" size="xs" title={sitemapTitle} onClick={handleClickSitemap}>
          <Button.Icon icon={sitemapIcon} />
        </Button>
      </div>
    </div>
  );
};

export default DirectoryHeader;
