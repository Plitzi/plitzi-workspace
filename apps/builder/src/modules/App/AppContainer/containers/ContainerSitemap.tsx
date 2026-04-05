import Card from '@plitzi/plitzi-ui/Card';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import WorkflowDiagram from '@pmodules/App/components/WorkflowDiagram';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';
import PageForm from '@pmodules/App/models/PageForm';

import type { BuilderState, Element, PageFolder } from '@plitzi/sdk-shared';
import type { Connection, Edge, Node } from '@pmodules/App/components/WorkflowDiagram';

const ContainerSitemap = () => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [[pageFolders, pageDefinitions]] = useStore(['schema.pageFolders', 'pageDefinitions']);
  const pages = useMemo(() => Object.values(pageDefinitions), [pageDefinitions]);

  const handleAddNode = useCallback(
    async (nodeType: 'page' | 'folder' | 'custom') => {
      if (nodeType === 'page') {
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
      } else if (nodeType === 'folder') {
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
          void eventBridge.emit('main', 'schemaAddPageFolder', response);
        }
      }
    },
    [eventBridge, pageFolders, showModal]
  );

  const handleAddEdge = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      const nodeSource: PageFolder | undefined = pageFolders.find(pageFolder => pageFolder.id === source);
      const nodeTarget = (pageDefinitions[target] as Element | undefined) ?? pageFolders.find(f => f.id === target);
      if (!nodeSource || !nodeTarget) {
        return;
      }

      if ('attributes' in nodeTarget && 'definition' in nodeTarget) {
        // Its an element
        void eventBridge.emit('main', 'schemaUpdateElement', {
          ...nodeTarget,
          attributes: { ...nodeTarget.attributes, folder: source }
        });
      } else {
        // Its a folder
        void eventBridge.emit('main', 'schemaUpdatePageFolder', { ...nodeTarget, parentId: source });
      }
    },
    [eventBridge, pageDefinitions, pageFolders]
  );

  const handleRemoveNode = useCallback(
    (node: Node) => {
      const nodeTarget = node.data.type === 'page' ? pageDefinitions[node.id] : pageFolders.find(f => f.id === node.id);
      if (!nodeTarget) {
        return;
      }

      if (node.data.type === 'page') {
        void eventBridge.emit('main', 'schemaRemovePage', node.id);
      } else {
        void eventBridge.emit('main', 'schemaRemovePageFolder', node.id);
      }
    },
    [eventBridge, pageDefinitions, pageFolders]
  );

  const handleRemoveEdge = useCallback(
    (connection: Connection | Edge) => {
      const { target } = connection;
      const nodeTarget = (pageDefinitions[target] as Element | undefined) ?? pageFolders.find(f => f.id === target);
      if (!nodeTarget) {
        return;
      }

      if ('attributes' in nodeTarget && 'definition' in nodeTarget) {
        // Its an element
        void eventBridge.emit('main', 'schemaUpdateElement', {
          ...nodeTarget,
          attributes: { ...nodeTarget.attributes, folder: '' }
        });
      } else {
        // Its a folder
        void eventBridge.emit('main', 'schemaUpdatePageFolder', { ...nodeTarget, parentId: '' });
      }
    },
    [eventBridge, pageDefinitions, pageFolders]
  );

  return (
    <Card className="relative flex grow flex-col">
      <Card.Body className="overflow-hidden" grow>
        <WorkflowDiagram
          pages={pages}
          pageFolders={pageFolders}
          onAddNode={handleAddNode}
          onAddEdge={handleAddEdge}
          onRemoveNode={handleRemoveNode}
          onRemoveEdge={handleRemoveEdge}
        />
      </Card.Body>
    </Card>
  );
};

export default ContainerSitemap;
