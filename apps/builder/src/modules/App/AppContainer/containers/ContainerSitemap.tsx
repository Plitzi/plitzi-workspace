import Card from '@plitzi/plitzi-ui/Card';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useMemo } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';
import WorkflowDiagram from '@pmodules/App/components/WorkflowDiagram';
import PageFolderForm from '@pmodules/App/models/PageFolderForm';
import PageForm from '@pmodules/App/models/PageForm';

import type { WorkflowNode } from '@pmodules/App/components/WorkflowDiagram';

const ContainerSitemap = () => {
  const { showModal } = useModal();
  const { eventBridge } = use(EventBridgeContext);
  const { pageDefinitions, pageFolders } = use(SchemaMainContext);
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

  const handleRemoveNode = useCallback((nodes: WorkflowNode[]) => {
    console.log('Remove nodes:', nodes);
  }, []);

  return (
    <Card className="relative flex grow flex-col">
      <Card.Body className="overflow-hidden" grow>
        <WorkflowDiagram
          pages={pages}
          pageFolders={pageFolders}
          onAddNode={handleAddNode}
          onRemoveNode={handleRemoveNode}
        />
      </Card.Body>
    </Card>
  );
};

export default ContainerSitemap;
