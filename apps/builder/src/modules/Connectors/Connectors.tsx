import Card from '@plitzi/plitzi-ui/Card';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo, useState } from 'react';

import ConnectorForm from './components/ConnectorForm';
import ConnectorList from './components/ConnectorList';
import ConnectorsContext from './ConnectorsContext';

const Connectors = () => {
  const { connectors, isLoading, error, addConnector, updateConnector, removeConnector } = use(ConnectorsContext);
  const { showDialog } = useModal();
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const items = useMemo(() => Object.values(connectors), [connectors]);
  const connector = editing ? connectors[editing] : undefined;

  const handleCreate = useCallback(() => {
    setEditing(undefined);
    setIsCreating(true);
  }, []);

  const handleCancel = useCallback(() => {
    setEditing(undefined);
    setIsCreating(false);
  }, []);

  const handleSubmit = useCallback(
    async (name: string, manifest: Record<string, unknown>) => {
      if (connector) {
        await updateConnector(connector.identifier, name, manifest);
      } else {
        await addConnector(name, manifest);
      }

      handleCancel();
    },
    [connector, updateConnector, addConnector, handleCancel]
  );

  const handleRemove = useCallback(
    async (identifier: string) => {
      // Removing a connector breaks every provider element pointing at it, and those elements live on published
      // pages — this is the one destructive action in the panel.
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove Connector</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>Any element reading through this connector will stop resolving. Remove it?</h4>
          </div>
        </Modal.Body>
      );

      if (confirmed) {
        await removeConnector(identifier);
      }
    },
    [showDialog, removeConnector]
  );

  return (
    <Card className="relative flex grow basis-0" rounded="none">
      <Card.Body grow>
        {isLoading && <div className="p-4 text-sm text-gray-500">Loading connectors…</div>}
        {!isLoading && error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {!isLoading && !error && !isCreating && !connector && (
          <ConnectorList connectors={items} onSelect={setEditing} onRemove={handleRemove} onCreate={handleCreate} />
        )}
        {!isLoading && !error && (isCreating || connector) && (
          <ConnectorForm
            key={connector?.identifier ?? 'new'}
            connector={connector}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </Card.Body>
    </Card>
  );
};

export default Connectors;
