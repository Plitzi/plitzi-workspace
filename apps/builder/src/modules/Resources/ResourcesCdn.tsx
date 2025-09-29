import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import get from 'lodash/get';
import { use, useCallback, useMemo } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import useInfiniteGraphQL from '@pmodules/Network/hooks/useInfiniteGraphQL';

import ResourceManager from './components/ResourceManager';
import ResourcesList from './ResourcesList';

import type { ResourceFile, ResourceWithFile, Resource as TResource } from './types';
import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type ResourcesCdnProps = {
  identifier: string;
  name: string;
  onRemove?: () => void;
};

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

const ResourcesCdn = ({ identifier, name, onRemove }: ResourcesCdnProps) => {
  const { addToast } = useToast();
  const { plugins, remove, add } = use(PluginsContext);
  const { data, isLoading, isValidating, isEmpty, mutate, setSize } = useInfiniteGraphQL(
    'SpaceResources',
    data => data.SpaceResources,
    { cdnIdentifier: identifier }
  );

  const finalResources = useMemo(() => {
    const pluginsArr = Object.values(plugins);

    return data.map(resource => {
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

  const handleClickLoadMore = useCallback(() => {
    if (isLoading || isEmpty) {
      return;
    }

    void setSize(state => state + 1);
  }, [isEmpty, isLoading, setSize]);

  return (
    <div className="bg-primary-100/50 flex min-h-[200px] flex-col gap-2 overflow-y-auto rounded-lg p-2">
      <Heading as="h5">{name}</Heading>
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
          <ResourcesList
            items={finalResources}
            className="max-h-[400px] overflow-y-auto"
            onRemove={handleResourceRemoved}
          />
        </>
      )}
      {!isEmpty && (
        <Button onClick={handleClickLoadMore} disabled={isLoading || isValidating} size="xs">
          {isLoading || isValidating ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </div>
  );
};

export default ResourcesCdn;
