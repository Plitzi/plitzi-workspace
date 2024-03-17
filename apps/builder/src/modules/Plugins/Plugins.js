// Packages
import React, { useCallback, useContext, useMemo } from 'react';
// import PropTypes from 'prop-types';
import get from 'lodash/get';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Alias
import ResourceManager from '@pmodules/Resources/ResourceManager';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import Plugin from './Plugin';

const Plugins = () => {
  const { mutate } = useContext(NetworkContext);
  const { showModal } = useModal();
  const { addToast } = useToast();
  const { components } = useContext(ComponentContext);
  const { plugins, update, remove, add } = useContext(PluginsContext);

  const onUpdate = type => async settings => {
    const plugin = plugins[type];
    if (!plugin) {
      return;
    }

    if (await update({ ...plugin, settings: { ...plugin.settings, ...settings } })) {
      addToast(
        <div>
          Plugin <b>{plugin.name}</b> Settings Updated
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    }
  };

  const onRemove = type => async () => {
    const plugin = plugins[type];
    if (!plugin) {
      return;
    }

    if (await remove(type)) {
      addToast(
        <div>
          Plugin <b>{`${plugin.name} ${plugin.version}`}</b> Removed
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );
    }
  };

  const pluginsData = Object.values(plugins).filter(plugin => plugin.isMain);

  const handleUploaded = useCallback(
    resource => {
      const pluginType = get(resource, 'metadata.root');
      const path = get(resource, 'path');
      add(pluginType, path);
    },
    [fetch, add]
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

  const uploadTypesMemo = useMemo(() => ['zip'], []);

  return (
    <div className="flex flex-col">
      <ResourceManager
        mutate={mutate}
        uploadTypes={uploadTypesMemo}
        onUploaded={handleUploaded}
        onUploadAdded={handleUploadAdded}
      />
      {pluginsData.length > 0 && (
        <div className="p-2 flex flex-col">
          {pluginsData.map((plugin, i) => {
            const {
              name,
              type,
              assets: { size },
              market: { backgroundColor, icon },
              settings,
              version,
              latestVersion
            } = plugin;
            const component = components[type];

            return (
              <Plugin
                key={i}
                name={name}
                backgroundColor={backgroundColor}
                icon={icon}
                version={version}
                newVersion={version !== latestVersion?.version}
                size={size}
                settings={{ ...get(component, 'settings', {}), ...settings }}
                onUpdate={onUpdate(type)}
                onRemove={onRemove(type)}
                showModal={showModal}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

Plugins.propTypes = {};

export default Plugins;
