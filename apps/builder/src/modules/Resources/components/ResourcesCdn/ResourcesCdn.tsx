import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Heading from '@plitzi/plitzi-ui/Heading';
import { get } from '@plitzi/plitzi-ui/helpers';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import SpaceCredentialSelectorModal from '@pmodules/Space/components/SpaceCredentialSelectorModal';

import ResourceManager from '../ResourceManager';
import ResourcesList from '../ResourcesList';

import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  ComponentDefinition,
  NetworkContextValue,
  ResourceFile,
  ResourceWithFile,
  Resource as TResource
} from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourcesCdnProps = {
  identifier: string;
  name: string;
  prefix: string;
  credentialIdentifier?: string;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
  onChange?: (identifier: string) => void;
  onRemove?: (identifier: string) => void;
};

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

const ResourcesCdn = ({
  identifier,
  name,
  prefix,
  credentialIdentifier,
  isCollapsed,
  onCollapse,
  onChange,
  onRemove
}: ResourcesCdnProps) => {
  const { addToast } = useToast();
  const { showDialog } = useModal();
  const [removing, setRemoving] = useState(false);
  const { plugins, remove, add } = use(PluginsContext);
  const { mutate: mutateNetwork } = use(NetworkContext) as NetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const { data, isLoading, mutate } = useGraphQL('SpaceResources', data => data?.SpaceResources.resources, {
    cdnIdentifier: identifier
  });

  const finalResources = useMemo(() => {
    const pluginsArr = Object.values(plugins);

    return (data ?? []).map(resource => {
      if (resource.type === 'plugin') {
        const plugin = pluginsArr.find(plugin => plugin.resource === resource.path);
        if (!plugin) {
          return resource;
        }

        return { ...resource, metadata: plugin.manifest };
      }

      return resource;
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
        const plugin = Object.values(plugins).find(plugin => plugin.type === resource.metadata.root && plugin.isMain);
        if (plugin) {
          void remove?.(plugin.type);
        }
      }

      void mutate();
    },
    [mutate, plugins, remove]
  );

  const handleChange = useCallback(() => void mutate(), [mutate]);

  const handleCollapse = useCallback(
    (isCollapsed: boolean) => onCollapse?.(identifier, isCollapsed),
    [identifier, onCollapse]
  );

  // const handleClickUpdate = useCallback((e: MouseEvent) => {
  //   e.stopPropagation();
  // }, []);

  const handleSelectCredential = useCallback(
    async (credentialIdentifier: string) => {
      const response = await mutateNetwork('SpaceSetCdnCredential', { identifier, credentialIdentifier });
      if (!response.success) {
        return;
      }

      onChange?.(identifier);
      void mutate();
    },
    [identifier, mutate, mutateNetwork, onChange]
  );

  const handleClickRemove = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      const response = await showDialog(
        <Modal.Header>
          <h4>Remove CDN</h4>
        </Modal.Header>,
        <Modal.Body>
          <h4>Do you want to remove this cdn ?</h4>
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
        title={<Heading as="h5">{name}</Heading>}
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <div className="rounded border border-gray-400 px-1 text-xs text-gray-500 dark:border-zinc-600 dark:text-zinc-400">
          {finalResources.length}
        </div>
        {/* <Icon
          icon="fa-solid fa-pencil"
          className="hidden cursor-pointer group-hover:block"
          title="Update"
          onClick={handleClickUpdate}
        /> */}
        <SpaceCredentialSelectorModal
          providersSupported={['r2', 's3']}
          selected={credentialIdentifier}
          onSelect={handleSelectCredential}
        >
          <Icon
            // intent="primary"
            icon="fa-solid fa-key"
            className="hidden cursor-pointer group-hover:block"
            title="Credentials"
          />
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
        {!removing && (
          <ResourceManager
            className="shrink-0"
            cdnIdentifier={identifier}
            uploadTypes={uploadTypes}
            onUploaded={handleUploaded}
            onUploadAdded={handleUploadAdded}
          />
        )}
        {!isLoading && !removing && (
          <ResourcesList
            className="overflow-y-auto"
            prefix={prefix}
            items={finalResources}
            cdnIdentifier={identifier}
            onChange={handleChange}
            onRemove={handleResourceRemoved}
          />
        )}
        {isLoading ||
          (removing && (
            <div className="flex w-full justify-center pt-2 pb-4">
              <Icon icon="fa-solid fa-sync" className="fa-spin fa-2x" />
            </div>
          ))}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ResourcesCdn;
