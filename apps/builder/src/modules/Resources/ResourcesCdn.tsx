import Heading from '@plitzi/plitzi-ui/Heading';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash/get';
import { use, useCallback, useMemo } from 'react';
import useSWR from 'swr';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import NetworkContext from '@pmodules/Network/NetworkContext';

import ResourceManager from './components/ResourceManager';
import ResourcesList from './ResourcesList';

import type { ResourceFile, ResourceWithFile, Resource as TResource } from './types';
import type { ComponentDefinition, PageInfo } from '@plitzi/sdk-shared';

export type ResourcesCdnProps = {
  id: number;
  identifier: string;
  name: string;
  onRemove?: () => void;
};

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

const ResourcesCdn = ({ id, identifier, name, onRemove }: ResourcesCdnProps) => {
  const { addToast } = useToast();
  const { query } = use(NetworkContext);
  const { plugins, remove, add } = use(PluginsContext);
  const { data, isLoading } = useSWR<{ edges?: TResource[]; pageInfo: PageInfo } | undefined | null>(
    ['SpaceResources', { cdnIdentifier: identifier }],
    ([queryKey, variables]) => query(queryKey, variables)
  );

  const finalResources = useMemo(() => {
    const pluginsArr = Object.values(plugins);

    return (
      data?.edges?.map(resource => {
        if (resource.type === 'plugin') {
          const plugin = pluginsArr.find(plugin => plugin.resource === resource.path);
          if (!plugin) {
            return resource;
          }

          return { ...resource, metadata: plugin.manifest };
        }

        return resource;
      }) ?? []
    );
  }, [plugins, data]);

  const handleUploaded = useCallback(
    (resource: ResourceWithFile) => {
      if (resource.type === 'plugin') {
        const pluginType = get(resource, 'metadata.root');
        const path = get(resource, 'path');
        if (pluginType && path) {
          void add?.(pluginType, path);
        }
      }

      void fetch('');
    },
    [add, fetch]
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
          {
            appeareance: 'info',
            autoDismiss: true,
            placement: 'top-right'
          }
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
    (resource: TResource) => () => {
      if (resource.type === 'plugin') {
        const plugin = Object.values(plugins).find(plugin => plugin.type === resource.metadata.root && plugin.isMain);
        if (plugin) {
          void remove?.(plugin.type);
        }
      }

      void fetch('');
    },
    [fetch, plugins, remove]
  );

  return (
    <div className="bg-primary-100 flex min-h-[200px] flex-col overflow-y-auto rounded-lg px-2">
      <Heading as="h5" className="mb-2">
        {name}
      </Heading>
      <ResourceManager
        className="shrink-0"
        cdnIdentifier={identifier}
        uploadTypes={uploadTypes}
        onUploaded={handleUploaded}
        onUploadAdded={handleUploadAdded}
      />
      {finalResources.length > 0 && (
        <Heading as="h5" className="mb-2">
          Uploaded
        </Heading>
      )}
      <ResourcesList items={finalResources} onRemove={handleResourceRemoved} />
    </div>
  );
};

export default ResourcesCdn;
