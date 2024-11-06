// Packages
import React, { useCallback, use, useEffect, useMemo, useState } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import Heading from '@plitzi/plitzi-ui-components/Heading';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import Resource from './Resource';
import ResourceManager from './ResourceManager';

const uploadTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'mp3', 'mp4', 'webp', 'mpeg', 'svg', 'webm', 'zip', 'json'];

/** @returns {React.ReactElement} */
const Resources = () => {
  const { query, mutate } = use(NetworkContext);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [, /* hasNextPage */ setHasNextPage] = useState(false);
  const [resources, setResources] = useState([]);
  const { plugins, remove, add } = use(PluginsContext);

  const handleResourceRemoved = resource => () => {
    if (resource.type === 'plugin') {
      const plugin = Object.values(plugins).find(plugin => plugin.resource === resource.path && plugin.isMain);
      if (plugin) {
        remove(plugin.type);
      }
    }

    fetch('');
  };

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

  const fetch = async search => {
    setLoading(true);
    const result = await query(
      'SpaceResources',
      { filter: { name: { contains: search } }, pageSize: 30 },
      'network-only'
    );
    if (!(result instanceof Error)) {
      const { pageInfo, edges } = result;
      setResources(edges);
      setHasNextPage(pageInfo.hasNextPage);
      setLoading(false);
    }
  };

  const handleUploaded = useCallback(
    resource => {
      if (resource.type === 'plugin') {
        const pluginType = get(resource, 'metadata.root');
        const path = get(resource, 'path');
        add(pluginType, path);
      }

      fetch('');
    },
    [fetch]
  );

  const handleUploadAdded = useCallback(
    resource => {
      if (resource.resourceType !== 'plugin') {
        return true;
      }

      const pluginType = get(resource, 'metadata.root');
      if (plugins[pluginType]) {
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

  useEffect(() => {
    fetch('');
  }, []);

  const finalResources = useMemo(() => {
    const pluginsArr = Object.values(plugins);

    return resources.map(resource => {
      if (resource.type === 'plugin') {
        const plugin = pluginsArr.find(plugin => plugin.resource === resource.path);
        if (!plugin) {
          return resource;
        }

        return { ...resource, metadata: plugin.manifest };
      }

      return resource;
    });
  }, [resources, plugins]);

  return (
    <div className="w-full flex flex-col overflow-y-auto grow basis-0">
      <ResourceManager
        className="shrink-0"
        mutate={mutate}
        uploadTypes={uploadTypes}
        onUploaded={handleUploaded}
        onUploadAdded={handleUploadAdded}
      />
      {!loading && finalResources.length > 0 && (
        <div className="flex flex-col px-2 basis-0 min-h-[200px] grow overflow-y-auto">
          <Heading type="h5" className="mb-2">
            Uploaded
          </Heading>
          <div className="grid grid-cols-2 gap-2 pb-1 overflow-y-auto">
            {finalResources.map(resource => (
              <Resource
                className={classNames({ 'col-span-2': resource.type === 'plugin' })}
                key={resource.id}
                id={resource.id}
                type={resource.type}
                title={resource.name}
                src={resource.path}
                metadata={resource.metadata}
                onRemove={handleResourceRemoved(resource)}
              />
            ))}
          </div>
        </div>
      )}
      {loading && (
        <div className="flex flex-col grow items-center justify-center">
          <i className="fa-solid fa-sync fa-spin fa-3x" title="Loading" />
        </div>
      )}
    </div>
  );
};

export default Resources;
