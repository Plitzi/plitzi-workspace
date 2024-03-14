// Packages
import React, { useCallback, useContext, useMemo, useState, useReducer } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import omit from 'lodash/omit';
import set from 'lodash/set';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';

// Relatives
import { pluginCompactDefinition, pluginParseDefinition } from './helpers/PluginHelper';
import PluginsReducer, { PluginsActions } from './PluginsReducer';

const PluginsContextProvider = props => {
  const { children, plugins: pluginsProp } = props;
  const internalData = useContext(NetworkInternalContext);
  const pluginsPropMemo = useMemo(() => {
    if (pluginsProp) {
      return pluginsProp;
    }

    return internalData.plugins ?? {};
  }, [pluginsProp]);
  const [plugins, dispatchPlugins] = useReducer(PluginsReducer, pluginsPropMemo);
  const [temporalCustomStyles, setTemporalCustomStyles] = useState({});
  const { mutate, query } = useContext(NetworkContext);
  const { components, registerDefinition, unregisterDefinition, unregister } = useContext(ComponentContext);

  const pluginsAdd = useCallback(
    plugin => dispatchPlugins({ type: PluginsActions.PLUGINS_ADD, plugin: pluginCompactDefinition(plugin) }),
    [dispatchPlugins]
  );

  const pluginsUpdate = useCallback(
    plugin => dispatchPlugins({ type: PluginsActions.PLUGINS_UPDATE, plugin: pluginCompactDefinition(plugin) }),
    [dispatchPlugins]
  );

  const pluginsRemove = useCallback(
    pluginType => dispatchPlugins({ type: PluginsActions.PLUGINS_REMOVE, pluginType }),
    [dispatchPlugins]
  );

  // internal

  const getStyle = plugins => {
    return Object.values(plugins).reduce(
      (acum, plugin) => ({
        ...acum,
        ...get(plugin, 'assets', [])
          .filter(asset => asset.type === 'style')
          .reduce((acum2, asset) => {
            const { url } = asset;
            const urlEncoded = btoa(url);

            return {
              ...acum2,
              [urlEncoded]: {
                type: 'link',
                key: urlEncoded,
                params: { href: url, rel: 'stylesheet', type: 'text/css' }
              }
            };
          }, {})
      }),
      {}
    );
  };

  const [pluginStyleAssets, setPluginStyleAssets] = useState(() => getStyle(plugins));

  // plugins

  const fetch = useCallback(async (filter, cursor, limit) => {
    // @todo: revisar esto
    // , append = []
    // const { pluginsAddMany } = this.props;
    const result = await query('Plugins', { filter, cursor, limit }, 'network-only');

    // pluginsAddMany([...append, ...result.data.Plugins.edges]);

    return result;
  }, []);

  const add = async (pluginType, pluginVersion) => {
    const result = await mutate('SpaceAddPlugin', { pluginType, pluginVersion });
    if (result) {
      const { plugins } = result;
      const plugin = plugins.find(plug => plug.plugin.type === pluginType);
      pluginsAdd(plugin);
      registerDefinition(pluginParseDefinition(plugin));
      setPluginStyleAssets(state => getStyle({ ...state, [pluginType]: pluginCompactDefinition(plugin) }));

      return true;
    }

    return false;
  };

  const update = async (pluginType, pluginVersion) => {
    const result = await mutate('SpaceUpdatePlugin', { pluginType, pluginVersion });
    if (result) {
      const { plugins } = result;
      const plugin = plugins.find(plug => plug.plugin.type === pluginType);
      pluginsUpdate(plugin);

      return true;
    }

    return false;
  };

  const getPluginSettings = useCallback(
    (pluginType, attribute = null, defaultValue = '') => {
      if (!attribute) {
        return get(plugins, `${pluginType}.settings`, {});
      }

      return get(plugins, `${pluginType}.settings.${attribute}`, defaultValue);
    },
    [plugins]
  );

  const setPluginSettings = async (pluginType, attribute, value) => {
    const plugin = cloneDeep(plugins[pluginType]);
    if (!plugin) {
      return;
    }

    set(plugin, `settings.${attribute}`, value);
    await update(plugin);
  };

  const remove = async pluginType => {
    const result = await mutate('SpaceRemovePlugin', { pluginType });
    if (result) {
      pluginsRemove(pluginType);
      setPluginStyleAssets(state => getStyle(omit(state, [pluginType])));
      unregisterDefinition(pluginType);
      unregister(pluginType);

      return true;
    }

    return false;
  };

  const registerCustomAssets = useCallback((assets = []) => {
    const assetsProcessed = assets
      .filter(asset => !isEmpty(asset?.url))
      .reduce((acum, asset) => {
        const isScript = asset?.url?.endsWith('.js');
        let assetToAdd = {};
        if (isScript) {
          assetToAdd = {
            type: 'script',
            key: btoa(asset?.url),
            params: { src: asset?.url, type: 'text/javascript', ...omit(asset, ['url']) }
          };
        } else {
          assetToAdd = {
            type: 'link',
            key: btoa(asset?.url),
            params: { href: asset?.url, rel: 'stylesheet', type: 'text/css', ...omit(asset, ['url']) }
          };
        }

        return { ...acum, [btoa(asset?.url)]: assetToAdd };
      }, {});
    if (Object.keys(assetsProcessed).length === 0) {
      return;
    }

    setTemporalCustomStyles(state => ({ ...state, ...assetsProcessed }));
  }, []);

  const unregisterCustomAssets = useCallback((assets = []) => {
    const keys = assets.filter(asset => !isEmpty(asset)).map(asset => btoa(asset));
    setTemporalCustomStyles(state => omit(state, keys));
  }, []);

  const pluginCustomStyleAssets = useMemo(
    () =>
      Object.keys(components)
        .filter(compKey => components[compKey].origin === 'local-custom')
        .reduce(
          (acum, compKey) => ({
            ...acum,
            ...get(components, `${compKey}.assets`, []).reduce(
              (acum, asset, i) => ({
                ...acum,
                [`${compKey}-${i}`]: { type: 'link', id: `${compKey}-${i}`, params: asset }
              }),
              {}
            )
          }),
          {}
        ),
    [plugins]
  );

  const baseAssets = useMemo(
    () => ({
      'static-1': {
        type: 'link',
        id: 'static-1',
        params: {
          type: 'text/css',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
          rel: 'stylesheet'
        }
      },
      'static-2': {
        type: 'link',
        id: 'static-2',
        params: {
          type: 'text/css',
          href: 'https://fonts.googleapis.com/css?family=Rubik:400|Bitter:400|Changa One:400|Droid Sans:400|Droid Serif:400|Exo:400|Great Vibes:400|Inconsolata:400|Lato:400|Merriweather:400|Montserrat:400|Open Sans:400|Oswald:400|PT Sans:400|PT Serif:400|Ubuntu:400|Varela:400|Varela Round:400|Vollkorn:400&amp;text=RubikBterChang ODodSsfExGVIclLMwpPTU',
          rel: 'stylesheet'
        }
      }
    }),
    []
  );

  const assetsState = useMemo(
    () => ({ ...baseAssets, ...pluginStyleAssets, ...pluginCustomStyleAssets, ...temporalCustomStyles }),
    [pluginStyleAssets, pluginCustomStyleAssets, temporalCustomStyles]
  );

  const pluginStyles = useMemo(() => {
    const style = {};
    Object.values(plugins).forEach(plugin => {
      const { subPlugins, type } = plugin;
      const pluginAssets = get(plugin, 'assets', [])
        .filter(asset => asset.type === 'style')
        .map(asset => asset.url);
      if (type && pluginAssets.length > 0) {
        style[type] = pluginAssets;
      }

      if (subPlugins && pluginAssets.length > 0) {
        plugin.subPlugins.forEach(subPlugin => {
          style[subPlugin] = pluginAssets;
        });
      }
    });

    return style;
  }, [plugins]);

  const pluginsContextValue = useMemo(
    () => ({
      baseAssets,
      assets: assetsState,
      plugins,
      dispatchPlugins,
      fetch,
      add,
      setSettings: setPluginSettings,
      getSettings: getPluginSettings,
      update,
      remove,
      registerCustomAssets,
      unregisterCustomAssets,
      pluginStyles
    }),
    [
      baseAssets,
      assetsState,
      plugins,
      dispatchPlugins,
      fetch,
      add,
      registerCustomAssets,
      unregisterCustomAssets,
      setPluginSettings,
      getPluginSettings,
      update,
      remove,
      pluginStyles
    ]
  );

  return <PluginsContext.Provider value={pluginsContextValue}>{children}</PluginsContext.Provider>;
};

PluginsContextProvider.propTypes = {
  children: PropTypes.node,
  plugins: PropTypes.object
};

export default PluginsContextProvider;
