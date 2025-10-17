import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';
import { useCallback, use, useMemo, useState, useReducer } from 'react';

import { getStyle, pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';

import PluginsReducer from './PluginsReducer';

import type { ComponentDefinition, Asset, ComponentPlugin } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { ReactNode } from 'react';

export type PluginsContextProviderProps = {
  children?: ReactNode;
  plugins?: Record<string, ComponentDefinition>;
};

const PluginsContextProvider = ({ children, plugins: pluginsProp }: PluginsContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const pluginsPropMemo = useMemo(() => {
    if (pluginsProp) {
      return pluginsProp;
    }

    return internalData.plugins;
  }, [internalData.plugins, pluginsProp]);
  const [plugins, dispatchPlugins] = useReducer(PluginsReducer, pluginsPropMemo);
  const [temporalCustomStyles, setTemporalCustomStyles] = useState<Record<string, Asset>>({});
  const { mutate, query } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const { components, registerDefinition, unregisterDefinition, unregister } = use(ComponentContext);

  const pluginsAdd = useCallback(
    (plugins: Record<string, ComponentDefinition>) => {
      if (typeof plugins !== 'object') {
        return;
      }

      const pluginsArr = Object.values(plugins);
      if (pluginsArr.length > 1) {
        dispatchPlugins({ type: 'addMany', plugins });
      } else {
        dispatchPlugins({ type: 'add', plugin: pluginsArr[0] });
      }
    },
    [dispatchPlugins]
  );

  const pluginsUpdate = useCallback(
    (plugins: Record<string, ComponentDefinition>) => {
      if (typeof plugins !== 'object') {
        return;
      }

      const pluginsArr = Object.values(plugins);
      if (pluginsArr.length > 1) {
        dispatchPlugins({ type: 'updateMany', plugins });
      } else {
        dispatchPlugins({ type: 'update', plugin: pluginsArr[0] });
      }
    },
    [dispatchPlugins]
  );

  const pluginsRemove = useCallback(
    (pluginTypes: string | string[]) => {
      if (Array.isArray(pluginTypes)) {
        dispatchPlugins({ type: 'removeMany', pluginTypes });
      } else {
        dispatchPlugins({ type: 'remove', pluginType: pluginTypes });
      }
    },
    [dispatchPlugins]
  );

  // internal

  const [pluginStyleAssets, setPluginStyleAssets] = useState(() => getStyle(plugins));

  // plugins

  const fetch = useCallback(
    async (filter: object, cursor: string, limit: number) => {
      // @todo: revisar esto
      // , append = []
      // const { pluginsAddMany } = this.props;
      const response = await query('Plugins', { filter, cursor, limit }, 'network-only');

      // pluginsAddMany([...append, ...result.data.Plugins.edges]);

      return response.result?.Plugins ?? [];
    },
    [query]
  );

  const add = useCallback(
    async (pluginType: string, resource?: string) => {
      const response = await mutate('SpaceAddPlugin', { pluginType, resource, override: true });
      if (response.result) {
        const plugin = response.result.plugins.find(plug => plug.type === pluginType);
        if (!plugin) {
          return false;
        }

        const pluginDefinition = await pluginParseDefinition([plugin]);
        pluginsAdd(pluginDefinition);
        registerDefinition(pluginDefinition);
        setPluginStyleAssets(state => ({ ...state, ...getStyle(pluginDefinition) }));

        return true;
      }

      return false;
    },
    [mutate, pluginsAdd, registerDefinition]
  );

  const update = useCallback(
    async (plugin: ComponentDefinition, resource?: string) => {
      const response = await mutate('SpaceUpdatePlugin', { pluginType: plugin.type, resource });
      if (response.result) {
        const newPlugin = response.result.plugins.find(plug => plug.type === plugin.type);
        if (!newPlugin) {
          return false;
        }

        const pluginDefinition = await pluginParseDefinition(newPlugin);
        pluginsUpdate(pluginDefinition);

        return true;
      }

      return false;
    },
    [mutate, pluginsUpdate]
  );

  const getPluginSettings = useCallback(
    (pluginType: string, attribute?: string, defaultValue: string | number | boolean = '') => {
      if (!attribute) {
        return get(plugins, `${pluginType}.settings`, {});
      }

      return get(plugins, `${pluginType}.settings.${attribute}`, defaultValue);
    },
    [plugins]
  );

  const setPluginSettings = useCallback(
    async (pluginType: string, attribute: string, value: string) => {
      if (!(plugins[pluginType] as ComponentDefinition | undefined)) {
        return false;
      }

      const plugin = cloneDeep(plugins[pluginType]);
      set(plugin, `settings.${attribute}`, value);
      return await update(plugin);
    },
    [plugins, update]
  );

  const remove = useCallback(
    async (pluginType: string) => {
      const response = await mutate('SpaceRemovePlugin', { pluginType });
      if (response.result) {
        const subPlugins = get(plugins, `${pluginType}.subPlugins`, []) as string[];
        pluginsRemove([pluginType, ...subPlugins]);
        setPluginStyleAssets(state => getStyle(omit(state, [pluginType])));
        unregisterDefinition(pluginType);
        unregister(pluginType);

        return true;
      }

      return false;
    },
    [mutate, plugins, pluginsRemove, unregister, unregisterDefinition]
  );

  const registerCustomAssets = useCallback((assets: Asset[] = []) => {
    const assetsProcessed = assets.reduce<Record<string, Asset>>((acum, asset) => {
      let url = '';
      if (asset.type === 'script') {
        url = asset.params.src;
      } else {
        url = asset.params.href;
      }

      if (!url) {
        return acum;
      }

      url = btoa(url);

      return { ...acum, [url]: { ...asset, key: url } };
    }, {});

    if (Object.keys(assetsProcessed).length === 0) {
      return;
    }

    setTemporalCustomStyles(state => ({ ...state, ...assetsProcessed }));
  }, []);

  const unregisterCustomAssets = useCallback((assets: string[] = []) => {
    const keys = assets.filter(asset => !isEmpty(asset)).map(asset => btoa(asset));
    setTemporalCustomStyles(state => omit(state, keys));
  }, []);

  const pluginCustomStyleAssets = useMemo<Record<string, Asset>>(
    () =>
      Object.keys(components)
        .filter(compKey => components[compKey].origin === 'local-custom')
        .reduce((acum, compKey) => {
          const assets = get(components, `${compKey}.assets`, []) as ComponentPlugin['assets'];

          return {
            ...acum,
            ...assets.reduce(
              (acum2, asset, i) => ({
                ...acum2,
                [`${compKey}-${i}`]: { type: 'link', id: `${compKey}-${i}`, params: asset }
              }),
              {}
            )
          };
        }, {}),
    [components]
  );

  const baseAssets = useMemo<Record<string, Asset>>(
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
    [baseAssets, pluginStyleAssets, pluginCustomStyleAssets, temporalCustomStyles]
  );

  // @todo: revisar donde se usa
  const pluginStyles = useMemo(() => {
    const style: Record<string, string[]> = {};
    Object.values(plugins).forEach(plugin => {
      const { subPlugins, type, assets = [] } = plugin;
      const pluginAssets = assets.filter(asset => asset.type === 'link').map(asset => asset.params.href);
      if (type && pluginAssets.length > 0) {
        style[type] = pluginAssets;
      }

      if (pluginAssets.length > 0) {
        subPlugins.forEach(subPlugin => {
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

  return <PluginsContext value={pluginsContextValue}>{children}</PluginsContext>;
};

export default PluginsContextProvider;
