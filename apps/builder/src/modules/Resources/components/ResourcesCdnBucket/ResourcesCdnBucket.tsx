import { get } from '@plitzi/plitzi-ui/helpers';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { mainPluginOf } from '../../helpers';
import ResourceCdnBucketForm from '../../Models/ResourceCdnBucketForm';
import ResourceManager from '../ResourceManager';
import ResourcesList from '../ResourcesList';

import type { ResourceCdnBucketFormValues } from '../../Models/ResourceCdnBucketForm';
import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  CdnBucket,
  ComponentDefinition,
  NetworkContextValue,
  ResourceFile,
  ResourceWithFile,
  Resource as TResource
} from '@plitzi/sdk-shared';

export type ResourcesCdnBucketProps = {
  cdnIdentifier: string;
  /** The CDN's provider: what a bucket's settings ask for depends on it. */
  provider: 's3' | 'r2';
  bucket: CdnBucket;
  /** The folder every file of the space is kept under in its buckets. */
  prefix: string;
  /** The CDN changed — a bucket added, edited or removed — and its list is read again. */
  onChange?: () => void;
};

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

/**
 * One bucket of a CDN and the space's files in it. A public one takes uploads — plugins, images, snippets — and serves
 * them at its domain; a private one keeps the space's server code, written when it is saved or pushed, and serves
 * nothing.
 */
const ResourcesCdnBucket = ({ cdnIdentifier, provider, bucket, prefix, onChange }: ResourcesCdnBucketProps) => {
  const { addToast } = useToast();
  const { showDialog, showModal } = useModal();
  const [removing, setRemoving] = useState(false);
  const { plugins, remove, add } = use(PluginsContext);
  const { mutate: mutateNetwork } = use(NetworkContext) as NetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const isPrivate = bucket.visibility === 'private';
  const { data, error, isLoading, mutate } = useGraphQL('SpaceResources', data => data?.SpaceResources.resources, {
    cdnIdentifier,
    bucketIdentifier: bucket.identifier
  });

  const finalResources = useMemo(() => {
    const pluginsArr = Object.values(plugins);

    return (data ?? []).map(resource => {
      if (resource.type !== 'plugin') {
        return resource;
      }

      const plugin = pluginsArr.find(candidate => candidate.resource === resource.path);

      return plugin ? { ...resource, metadata: plugin.manifest } : resource;
    });
  }, [plugins, data]);

  const handleUploaded = useCallback(
    (resource: ResourceWithFile) => {
      if (resource.type === 'plugin') {
        const pluginType: string = get(resource, 'file.metadata.root', '');
        const path = get(resource, 'path');
        if (pluginType && path) {
          void add?.(pluginType, path);
        }
      }

      void mutate();
    },
    [add, mutate]
  );

  const handleUploadAdded = useCallback(
    (resource: ResourceFile) => {
      if (resource.resourceType !== 'plugin') {
        return true;
      }

      const pluginType = get(resource, 'metadata.root') as string;
      if (plugins[pluginType] as ComponentDefinition | undefined) {
        addToast(
          <div>
            Plugin <b>{get(resource, 'metadata.definition.name', '')}</b> already installed
          </div>,
          { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
        );
      }

      return !plugins[pluginType];
    },
    [plugins, addToast]
  );

  const handleResourceRemoved = useCallback(
    (resource: TResource) => {
      if (resource.type === 'plugin') {
        const plugin = mainPluginOf(plugins, resource.metadata.root);
        if (plugin) {
          void remove?.(plugin.type);
        }
      }

      void mutate();
    },
    [mutate, plugins, remove]
  );

  const handleChange = useCallback(() => void mutate(), [mutate]);

  const handleClickEdit = useCallback(async () => {
    const response = await showModal<ResourceCdnBucketFormValues>(
      <Modal.Header>
        <h4>Bucket settings</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <ResourceCdnBucketForm
            provider={provider}
            name={bucket.name}
            bucketName={bucket.bucketName}
            region={bucket.region}
            visibility={bucket.visibility}
            domain={bucket.domain}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        </Modal.Body>
      )
    );
    if (!response) {
      return;
    }

    const updated = await mutateNetwork('SpaceUpdateCdnBucket', {
      cdnIdentifier,
      identifier: bucket.identifier,
      ...response
    });
    if (updated.success) {
      onChange?.();
      void mutate();
    }
  }, [bucket, cdnIdentifier, mutate, mutateNetwork, onChange, provider, showModal]);

  const handleClickRemove = useCallback(async () => {
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Remove bucket</h4>
      </Modal.Header>,
      <Modal.Body>
        <h4>Take “{bucket.name}” off this CDN? Its files stay in the provider’s bucket.</h4>
      </Modal.Body>,
      undefined,
      { size: 'sm' },
      bucket.identifier
    );
    if (!confirmed) {
      return;
    }

    setRemoving(true);
    const removed = await mutateNetwork('SpaceRemoveCdnBucket', { cdnIdentifier, identifier: bucket.identifier });
    setRemoving(false);
    if (removed.success) {
      onChange?.();
    }
  }, [bucket, cdnIdentifier, mutateNetwork, onChange, showDialog]);

  return (
    <div className="group/bucket flex flex-col gap-2 rounded-md border border-gray-200 p-2 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <Icon icon={isPrivate ? 'fa-solid fa-lock' : 'fa-solid fa-bucket'} size="xs" className="text-gray-500" />
        <span
          className="max-w-1/2 shrink-0 truncate text-sm font-semibold text-gray-700 dark:text-zinc-200"
          title={bucket.bucketName}
        >
          {bucket.name}
        </span>
        {isPrivate && (
          <span
            className="rounded border border-amber-400 px-1 text-xs text-amber-700 dark:border-amber-700 dark:text-amber-400"
            title="No public address: Plitzi reads it with the CDN’s credential, for the space’s server code"
          >
            Private
          </span>
        )}
        {!isPrivate && (
          <span className="min-w-0 truncate text-xs text-gray-400 dark:text-zinc-500" title={bucket.domain}>
            {bucket.domain}
          </span>
        )}
        <span className="ml-auto rounded border border-gray-400 px-1 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
          {finalResources.length}
        </span>
        <Icon
          icon="fa-solid fa-gear"
          className="hidden cursor-pointer group-hover/bucket:block"
          title="Bucket settings"
          onClick={handleClickEdit}
        />
        <Icon
          intent="danger"
          icon="fas fa-trash-alt"
          className="hidden cursor-pointer group-hover/bucket:block"
          title="Remove bucket"
          onClick={handleClickRemove}
        />
      </div>
      {isPrivate && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Where this space keeps its server code — its functions and runtime, written when they are saved or pushed. Its
          files have no public address, so plugins, images and snippets go in a public bucket.
        </p>
      )}
      {!isPrivate && !removing && (
        <ResourceManager
          className="shrink-0"
          cdnIdentifier={cdnIdentifier}
          bucketIdentifier={bucket.identifier}
          uploadTypes={uploadTypes}
          onUploaded={handleUploaded}
          onUploadAdded={handleUploadAdded}
        />
      )}
      {/* Kept on screen, beside the toast that announced it: an empty list would read as "nothing uploaded yet". */}
      {error && !isLoading && !removing && (
        <div className="flex flex-col gap-1 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <span className="font-semibold">This bucket cannot be read</span>
          <span>{error.message}</span>
          <span>Check its settings, or choose or fix the CDN’s credential with the key above.</span>
        </div>
      )}
      {!error && !isLoading && !removing && (
        <ResourcesList
          className="overflow-y-auto"
          prefix={prefix}
          items={finalResources}
          cdnIdentifier={cdnIdentifier}
          bucketIdentifier={bucket.identifier}
          visibility={bucket.visibility}
          onChange={handleChange}
          onRemove={handleResourceRemoved}
        />
      )}
      {(isLoading || removing) && (
        <div className="flex w-full justify-center pt-2 pb-4">
          <Icon icon="fa-solid fa-sync" className="fa-spin fa-2x" />
        </div>
      )}
    </div>
  );
};

export default ResourcesCdnBucket;
