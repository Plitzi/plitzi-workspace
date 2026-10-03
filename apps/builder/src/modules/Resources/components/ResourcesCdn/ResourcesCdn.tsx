import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Heading from '@plitzi/plitzi-ui/Heading';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useCallback, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import ResourceCdnAccountForm from '../../Models/ResourceCdnAccountForm';
import ResourceCdnBucketForm from '../../Models/ResourceCdnBucketForm';
import ResourcesCdnBucket from '../ResourcesCdnBucket';

import type { ResourceCdnAccountFormValues } from '../../Models/ResourceCdnAccountForm';
import type { ResourceCdnBucketFormValues } from '../../Models/ResourceCdnBucketForm';
import type { Cdn } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourcesCdnProps = {
  /** The CDN as the space's list gives it: its account and its buckets. */
  cdn: Cdn;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
  onChange?: (identifier: string) => void;
  onRemove?: (identifier: string) => void;
};

/**
 * A CDN — the customer's own storage account — and its buckets, each with its own configuration and files. The account
 * holds the credential every bucket is opened with.
 */
const ResourcesCdn = ({ cdn, isCollapsed, onCollapse, onChange, onRemove }: ResourcesCdnProps) => {
  const { showDialog, showModal } = useModal();
  const [removing, setRemoving] = useState(false);
  const { mutate: mutateNetwork } = useBuilderNetwork();
  const { identifier } = cdn;

  const handleChange = useCallback(() => onChange?.(identifier), [identifier, onChange]);

  const handleCollapse = useCallback(
    (collapsed: boolean) => onCollapse?.(identifier, collapsed),
    [identifier, onCollapse]
  );

  const handleSelectCredential = useCallback(
    async (credentialIdentifier: string) => {
      const response = await mutateNetwork('SpaceSetCdnCredential', { identifier, credentialIdentifier });
      if (response.success) {
        onChange?.(identifier);
      }
    },
    [identifier, mutateNetwork, onChange]
  );

  const handleClickSettings = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showModal<ResourceCdnAccountFormValues>(
        <Modal.Header>
          <h4>CDN settings</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <ResourceCdnAccountForm
              name={cdn.name}
              provider={cdn.provider}
              endpoint={cdn.endpoint}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          </Modal.Body>
        )
      );
      if (!response) {
        return;
      }

      const updated = await mutateNetwork('SpaceUpdateCdn', { identifier, ...response });
      if (updated.success) {
        onChange?.(identifier);
      }
    },
    [cdn, identifier, mutateNetwork, onChange, showModal]
  );

  const handleClickAddBucket = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showModal<ResourceCdnBucketFormValues>(
        <Modal.Header>
          <h4>Add a bucket</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <ResourceCdnBucketForm provider={cdn.provider} onSubmit={onSubmit} onClose={onClose} />
          </Modal.Body>
        )
      );
      if (!response) {
        return;
      }

      const added = await mutateNetwork('SpaceAddCdnBucket', { cdnIdentifier: identifier, ...response });
      if (added.success) {
        onChange?.(identifier);
      }
    },
    [cdn.provider, identifier, mutateNetwork, onChange, showModal]
  );

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove CDN</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Remove this CDN and its buckets? Their files stay in the provider’s buckets.</h4>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        identifier
      );

      if (response) {
        setRemoving(true);
        await mutateNetwork('SpaceRemoveCdn', { identifier });
        setRemoving(false);
        onRemove?.(identifier);
      }
    },
    [identifier, mutateNetwork, onRemove, showDialog]
  );

  return (
    <ContainerCollapsable collapsed={isCollapsed} onChange={handleCollapse}>
      <ContainerCollapsable.Header
        className={{ header: 'group', headerSlot: 'flex items-center gap-2' }}
        title={<Heading as="h5">{cdn.name}</Heading>}
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <div
          className="rounded border border-gray-400 px-1 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400"
          title="Buckets"
        >
          {cdn.buckets.length}
        </div>
        <Icon
          icon="fa-solid fa-plus"
          className="hidden cursor-pointer group-hover:block"
          title="Add a bucket"
          onClick={handleClickAddBucket}
        />
        <Icon
          icon="fa-solid fa-gear"
          className="hidden cursor-pointer group-hover:block"
          title="CDN settings"
          onClick={handleClickSettings}
        />
        <SpaceCredentialSelectorModal
          providersSupported={['r2', 's3']}
          selected={cdn.credential?.identifier}
          onSelect={handleSelectCredential}
        >
          <Icon icon="fa-solid fa-key" className="hidden cursor-pointer group-hover:block" title="Credentials" />
        </SpaceCredentialSelectorModal>
        <Icon
          intent="danger"
          icon="fas fa-trash-alt"
          className="hidden cursor-pointer group-hover:block"
          title="Remove"
          onClick={handleClickRemove}
        />
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content className="flex flex-col gap-3 py-2">
        {!removing &&
          cdn.buckets.map(bucket => (
            <ResourcesCdnBucket
              key={bucket.identifier}
              cdnIdentifier={identifier}
              provider={cdn.provider}
              bucket={bucket}
              prefix={`${cdn.prefix}/assets`}
              onChange={handleChange}
            />
          ))}
        {removing && (
          <div className="flex w-full justify-center pt-2 pb-4">
            <Icon icon="fa-solid fa-sync" className="fa-spin fa-2x" />
          </div>
        )}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ResourcesCdn;
