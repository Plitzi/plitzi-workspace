import Alert from '@plitzi/plitzi-ui/Alert';
import Card from '@plitzi/plitzi-ui/Card';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, use, useMemo, useState } from 'react';

import ConnectorForm from './components/ConnectorForm';
import ConnectorList from './components/ConnectorList';
import ConnectorsContext from './ConnectorsContext';
import { CONNECTOR_SERVER_ONLY_NOTE } from './helpers/manifestDoc';

import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

const Connectors = () => {
  const { connectors, isLoading, error, hasServerRendering, addConnector, updateConnector, removeConnector } =
    use(ConnectorsContext);
  const { showDialog } = useModal();
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  const items = useMemo(() => Object.values(connectors), [connectors]);
  const connector = editing ? connectors[editing] : undefined;
  const isEditing = isCreating || Boolean(connector);

  const handleCreate = useCallback(() => {
    setEditing(undefined);
    setIsCreating(true);
  }, []);

  const handleCancel = useCallback(() => {
    setEditing(undefined);
    setIsCreating(false);
  }, []);

  const handleSubmit = useCallback(
    async (name: string, manifest: ConnectorManifestDraft) => {
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
        {!isLoading && !error && !hasServerRendering && (
          <div className="p-4 pb-0">
            <Alert intent="warning" size="sm" solid={false}>
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium">This space has no server-rendered deployment.</span>
                <span>{CONNECTOR_SERVER_ONLY_NOTE}</span>
                <span>
                  Connectors still work in the builder preview. To reach visitors, deploy the space with a Plitzi SSR
                  credential.
                </span>
              </div>
            </Alert>
          </div>
        )}
        {!isLoading && !error && !isEditing && (
          <ConnectorList connectors={items} onSelect={setEditing} onRemove={handleRemove} onCreate={handleCreate} />
        )}
        {!isLoading && !error && isEditing && (
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
