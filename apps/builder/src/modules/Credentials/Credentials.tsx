import Button from '@plitzi/plitzi-ui/Button';
import Card from '@plitzi/plitzi-ui/Card';
import Heading from '@plitzi/plitzi-ui/Heading';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentials from '@pmodules/Space/components/SpaceCredentials';
import buildCredentialData from '@pmodules/Space/helpers/buildCredentialData';
import SpaceCredentialForm from '@pmodules/Space/Models/SpaceCredentialForm';

import type { BuilderMutationsMap, BuilderQueriesMap, SpaceCredentialProvider } from '@plitzi/sdk-shared';
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
const Credentials = () => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const { data = [], isLoading, mutate } = useGraphQL('SpaceCredentials', data => data?.SpaceCredentials.edges);
  const { showDialog } = useModal();
  const [provider, setProvider] = useState<SpaceCredentialProvider | undefined>(undefined);

  const handleCreate = useCallback(() => setProvider('custom'), []);

  const handleCloseForm = useCallback(() => setProvider(undefined), []);

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

  return (
    <Card className="relative flex grow basis-0" rounded="none">
      <Card.Body grow>
        {isLoading && <div className="p-4 text-sm text-gray-500">Loading credentials…</div>}
        {!isLoading && provider && (
          <div className="mx-auto w-full max-w-3xl p-4">
            <SpaceCredentialForm provider={provider} onSubmit={handleSubmitForm} onClose={handleCloseForm} />
          </div>
        )}
        {!isLoading && !provider && (
          <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col gap-4 p-4">
            <div className="flex w-full items-center justify-between">
              <Heading as="h5">Credentials</Heading>
              <Button size="sm" onClick={handleCreate}>
                New Credential
              </Button>
            </div>
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              Secrets are encrypted at rest and only ever resolved on the server. A connector names the credential it
              needs; the value itself never reaches the browser or the published page.
            </span>
            {data.length === 0 && (
              <div className="rounded-sm border-2 border-dashed border-gray-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                No credentials yet. Add the CMS token your connector authenticates with.
              </div>
            )}
            <SpaceCredentials credentials={data} onRemove={handleRemove} />
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default Credentials;
