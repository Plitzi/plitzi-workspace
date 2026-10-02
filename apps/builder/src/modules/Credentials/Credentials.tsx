import Button from '@plitzi/plitzi-ui/Button';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import EmptyState from '@pmodules/App/components/EmptyState';
import ViewPage from '@pmodules/App/components/ViewPage';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentials from '@pmodules/Space/components/SpaceCredentials';
import buildCredentialData from '@pmodules/Space/helpers/buildCredentialData';
import SpaceCredentialForm from '@pmodules/Space/Models/SpaceCredentialForm';

import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  SpaceCredentialProvider,
  SpaceCredential as TSpaceCredential
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { spaceCredentialFormSchema } from '@pmodules/Space/Models/SpaceCredentialForm';
import type { MouseEvent } from 'react';
import type z from 'zod';

/**
 * Manages the space's secrets in one place.
 *
 * Credentials were only reachable from the modals that consume them — a deployment form, a CDN row — so a secret
 * could not be prepared before the thing that needs it existed. A connector needs exactly that ordering: the CMS
 * token has to exist before there is a manifest to reference it from.
 */
const DESCRIPTION =
  'Secrets are encrypted at rest and only ever resolved on the server. A connector names the credential it needs; the value itself never reaches the browser or the published page.';

const Credentials = () => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const { data = [], isLoading, mutate } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges);
  const { showDialog } = useModal();
  const [provider, setProvider] = useState<SpaceCredentialProvider | undefined>(undefined);
  /** The credential whose values are being replaced. Only its name, identifier and provider are known here. */
  const [editing, setEditing] = useState<TSpaceCredential | undefined>(undefined);

  const handleCreate = useCallback(() => setProvider('custom'), []);

  const handleEdit = useCallback(
    (identifier: string) => setEditing(data.find(credential => credential.identifier === identifier)),
    [data]
  );

  const handleCloseForm = useCallback(() => {
    setProvider(undefined);
    setEditing(undefined);
  }, []);

  const handleSubmitForm = useCallback(
    async (_e: MouseEvent | undefined, values: z.infer<typeof spaceCredentialFormSchema>) => {
      const response = await mutateNetwork('SpaceAddCredential', {
        name: values.name,
        provider: values.provider,
        data: buildCredentialData(values)
      });
      if (!response.success) {
        return;
      }

      await mutate();
      setProvider(undefined);
    },
    [mutate, mutateNetwork]
  );

  const handleSubmitEdit = useCallback(
    async (_e: MouseEvent | undefined, values: z.infer<typeof spaceCredentialFormSchema>) => {
      if (!editing) {
        return;
      }

      const response = await mutateNetwork('SpaceUpdateCredential', {
        identifier: editing.identifier,
        name: values.name,
        provider: values.provider,
        data: buildCredentialData(values)
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
          <h4>Remove Credential</h4>
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
      New Credential
    </Button>
  );

  return (
    <>
      {isLoading && <ViewPage description="Loading credentials…" />}
      {!isLoading && provider && (
        <ViewPage onBack={handleCloseForm} backLabel="Credentials" title="New credential" description={DESCRIPTION}>
          <SpaceCredentialForm provider={provider} onSubmit={handleSubmitForm} onClose={handleCloseForm} />
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
      {!isLoading && !provider && !editing && (
        <ViewPage description={data.length > 0 ? DESCRIPTION : undefined} actions={data.length > 0 && createButton}>
          {data.length === 0 && (
            <EmptyState
              icon="fa-solid fa-key"
              title="No credentials yet"
              description={`${DESCRIPTION} Add the CMS token your connector authenticates with.`}
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
