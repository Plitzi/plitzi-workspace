import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Heading from '@plitzi/plitzi-ui/Heading';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash/get';
import { use, useCallback, useMemo } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import ResourceManager from './components/ResourceManager';
import ResourcesList from './components/ResourcesList';

import type { ComponentDefinition, ResourceFile, ResourceWithFile, Resource as TResource } from '@plitzi/sdk-shared';

export type ResourcesCdnProps = {
  identifier: string;
  name: string;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
  onRemove?: () => void;
};

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

const ResourcesCdn = ({ identifier, name, isCollapsed, onCollapse, onRemove }: ResourcesCdnProps) => {
  const { addToast } = useToast();
  const { plugins, remove, add } = use(PluginsContext);
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
      onRemove?.();
    },
    [add, mutate, onRemove]
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
            Plugin <b>{get(resource, 'metadata.definition.name')}</b> already installed
          </div>,
          { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
        );
      }

      return !plugins[pluginType];
    },
    [plugins, addToast]
  );

  // const handleResourceUpdated = type => async settings => {
  //   const plugin = plugins[type];
  //   if (!plugin) {
  //     return;
  //   }

  //   if (await update({ ...plugin, settings: { ...plugin.settings, ...settings } })) {
  //     addToast(
  //       <div>
  //         Plugin <b>{plugin.name}</b> Settings Updated
  //       </div>,
  //       {
  //         appeareance: 'success',
  //         autoDismiss: true,
  //         placement: 'top-right'
  //       }
  //     );
  //   }
  // };

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

  const handleCollapse = useCallback(
    (isCollapsed: boolean) => onCollapse?.(identifier, isCollapsed),
    [identifier, onCollapse]
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
        <div className="rounded border px-1 text-xs">{finalResources.length}</div>
        <Icon icon="fa-solid fa-pencil" className="hidden cursor-pointer group-hover:block" title="Update" />
        <Icon
          intent="danger"
          icon="fas fa-trash-alt"
          className="hidden cursor-pointer group-hover:block"
          title="Remove"
        />
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content className="flex flex-col gap-3 py-2">
        <ResourceManager
          className="shrink-0"
          cdnIdentifier={identifier}
          uploadTypes={uploadTypes}
          onUploaded={handleUploaded}
          onUploadAdded={handleUploadAdded}
        />
        {!isLoading && finalResources.length > 0 && (
          <>
            <Heading as="h5">Uploaded</Heading>
            <ResourcesList items={finalResources} className="overflow-y-auto" onRemove={handleResourceRemoved} />
          </>
        )}
        {isLoading && (
          <div className="flex w-full justify-center pt-2 pb-4">
            <Icon icon="fa-solid fa-sync" className="fa-spin fa-2x" />
          </div>
        )}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ResourcesCdn;
