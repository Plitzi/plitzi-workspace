import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, useState } from 'react';

import EmptyState from '@pmodules/App/components/EmptyState';
import ViewPage from '@pmodules/App/components/ViewPage';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentials from '@pmodules/Space/components/SpaceCredentials';
import SpaceCredentialForm, { credentialDataOf } from '@pmodules/Space/Models/SpaceCredentialForm';

import type { SpaceCredential as TSpaceCredential } from '@plitzi/sdk-shared';
import type { SpaceCredentialFormValues } from '@pmodules/Space/Models/SpaceCredentialForm';
import type { MouseEvent } from 'react';

/**
 * Manages the space's secrets in one place.
 *
 * Credentials were only reachable from the modals that consume them — a deployment form, a CDN row — so a secret
 * could not be prepared before the thing that needs it existed. A connector needs exactly that ordering: the CMS
 * token has to exist before there is a manifest to reference it from.
 */
const DESCRIPTION =
  'What the space signs in with — to an API, its storage, a host it deploys to, a mail server. Encrypted at rest and read only on the server: a value never reaches the browser or a published page.';

const Credentials = () => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { data = [], isLoading, mutate } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges);
  const { showDialog } = useModal();
  const [creating, setCreating] = useState(false);
  /** The credential whose values are being replaced. Only its name, identifier and provider are known here. */
  const [editing, setEditing] = useState<TSpaceCredential | undefined>(undefined);

  const handleCreate = useCallback(() => setCreating(true), []);

  const handleEdit = useCallback(
    (identifier: string) => setEditing(data.find(credential => credential.identifier === identifier)),
    [data]
  );

  const handleCloseForm = useCallback(() => {
    setCreating(false);
    setEditing(undefined);
  }, []);

  const handleSubmitForm = useCallback(
    async (_e: MouseEvent | undefined, values: SpaceCredentialFormValues) => {
      const response = await mutateNetwork('SpaceAddCredential', {
        name: values.name,
        provider: values.provider,
        data: credentialDataOf(values)
      });
      if (!response.success) {
        return;
      }

      await mutate();
      setCreating(false);
    },
    [mutate, mutateNetwork]
  );

  const handleSubmitEdit = useCallback(
    async (_e: MouseEvent | undefined, values: SpaceCredentialFormValues) => {
      if (!editing) {
        return;
      }

      const response = await mutateNetwork('SpaceUpdateCredential', {
        identifier: editing.identifier,
        name: values.name,
        provider: values.provider,
        data: credentialDataOf(values)
      });
      if (!response.success) {
        return;
      }

      await mutate();
      setEditing(undefined);
    },
    [editing, mutate, mutateNetwork]
  );

  const handleRemove = useCallback(
    async (identifier: string) => {
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove credential</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>Anything authenticating with this credential will stop working. Remove it?</h4>
          </div>
        </Modal.Body>
      );
      if (!confirmed) {
        return;
      }

      const response = await mutateNetwork('SpaceRemoveCredential', { identifier });
      if (response.success) {
        await mutate();
      }
    },
    [mutate, mutateNetwork, showDialog]
  );

  const createButton = (
    <Button size="sm" onClick={handleCreate} iconPlacement="before">
      <Button.Icon icon="fa-solid fa-plus" />
      New credential
    </Button>
  );

  return (
    <>
      {isLoading && <ViewPage description="Loading credentials…" />}
      {!isLoading && creating && (
        <ViewPage onBack={handleCloseForm} backLabel="Credentials" title="New credential" description={DESCRIPTION}>
          <SpaceCredentialForm onSubmit={handleSubmitForm} onClose={handleCloseForm} />
        </ViewPage>
      )}
      {!isLoading && editing && (
        <ViewPage onBack={handleCloseForm} backLabel="Credentials" title={editing.name} description={DESCRIPTION}>
          <SpaceCredentialForm
            key={editing.identifier}
            editing
            name={editing.name}
            provider={editing.provider}
            onSubmit={handleSubmitEdit}
            onClose={handleCloseForm}
          />
        </ViewPage>
      )}
      {!isLoading && !creating && !editing && (
        <ViewPage description={data.length > 0 ? DESCRIPTION : undefined} actions={data.length > 0 && createButton}>
          {data.length === 0 && (
            <EmptyState
              icon="fa-solid fa-key"
              title="No credentials yet"
              description={`${DESCRIPTION} Add the first: a CMS token, a storage key, a deploy token.`}
              action={createButton}
            />
          )}
          {data.length > 0 && <SpaceCredentials credentials={data} onEdit={handleEdit} onRemove={handleRemove} />}
        </ViewPage>
      )}
    </>
  );
};

export default Credentials;
