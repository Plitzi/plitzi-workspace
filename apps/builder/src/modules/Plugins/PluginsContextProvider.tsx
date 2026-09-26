import { get, set, omit, isEmpty, cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useEffect, useMemo, useRef, useState, useReducer } from 'react';

import { getStyle, pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';

import PluginsReducer from './PluginsReducer';

import type {
  ComponentDefinition,
  Asset,
  ComponentPlugin,
  BuilderQueriesMap,
  BuilderMutationsMap,
  PluginRaw
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { SpaceEventMap } from '@plitzi/sdk-shared/network/spaceEvents';
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
  const { mutate, subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap,
    SpaceEventMap
  >;
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
  // What is installed NOW, for the appliers below: a space event can arrive between renders, and a callback that
  // closed over an older map would diff a version against one that has already been replaced.
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;

  /**
   * A plugin installed — or installed again at a new address, which is how a new version arrives — made the one this
   * builder loads. The same whether this builder installed it or another did (a collaborator, `plitzi upload plugin`).
   */
  const applyAdded = useCallback(
    async (raw: PluginRaw) => {
      const previous = pluginsRef.current[raw.type] as ComponentDefinition | undefined;
      const pluginDefinition = await pluginParseDefinition([raw]);
      // Elements the previous version shipped and this one does not: gone with it, not left in the catalog.
      const dropped = (previous?.subPlugins ?? []).filter(subPlugin => !(subPlugin in pluginDefinition));
      if (dropped.length > 0) {
        pluginsRemove(dropped);
        dropped.forEach(subPlugin => {
          unregisterDefinition(subPlugin);
          unregister(subPlugin);
        });
      }

      pluginsAdd(pluginDefinition);
      registerDefinition(pluginDefinition);
      setPluginStyleAssets(state => ({
        // The previous version's stylesheets out, keyed by asset, before the new version's come in.
        ...(previous ? omit(state, Object.keys(getStyle({ [raw.type]: previous }))) : state),
        ...getStyle(pluginDefinition)
      }));
    },
    [pluginsAdd, pluginsRemove, registerDefinition, unregister, unregisterDefinition]
  );

  const applyUpdated = useCallback(
    async (raw: PluginRaw) => {
      pluginsUpdate(await pluginParseDefinition(raw));
    },
    [pluginsUpdate]
  );

  const applyRemoved = useCallback(
    (pluginType: string) => {
      const subPlugins = get(pluginsRef.current, `${pluginType}.subPlugins`, []) as string[];
      const removed = [pluginType, ...subPlugins];
      pluginsRemove(removed);
      // Keyed by asset, not by plugin: what is left is recomputed from the plugins that stay.
      setPluginStyleAssets(getStyle(omit(pluginsRef.current, removed)));
      unregisterDefinition(pluginType);
      unregister(pluginType);
    },
    [pluginsRemove, unregister, unregisterDefinition]
  );

  const add = useCallback(
    async (pluginType: string, resource?: string) => {
      const response = await mutate('SpaceAddPlugin', { pluginType, resource, override: true });
      const plugin = response.result?.plugins.find(plug => plug.type === pluginType);
      if (!plugin) {
        return false;
      }

      await applyAdded(plugin);

      return true;
    },
    [mutate, applyAdded]
  );

  /**
   * The plugin's address, its settings, or both: what is not sent is kept by the server. A settings change sends no
   * address, which is what made saving settings impossible while the address was required.
   */
  const update = useCallback(
    async (plugin: ComponentDefinition, resource?: string) => {
      const response = await mutate('SpaceUpdatePlugin', {
        pluginType: plugin.type,
        ...(resource ? { resource } : {}),
        settings: plugin.settings
      });
      const updated = response.result?.plugins.find(plug => plug.type === plugin.type);
      if (!updated) {
        return false;
      }

      await applyUpdated(updated);

      return true;
    },
    [mutate, applyUpdated]
  );

  /**
   * Every other builder's changes to the space's plugins, on the space's one channel — the same stream the schema's
   * changes arrive on. This builder's own are not sent back to it: the server filters by instance.
   */
  useEffect(() => {
    const stop = [
      subscriptionManager.subscribe('SPACE_ADD_PLUGIN', ({ plugin }) => void applyAdded(plugin)),
      subscriptionManager.subscribe('SPACE_UPDATE_PLUGIN', ({ plugin }) => void applyUpdated(plugin)),
      subscriptionManager.subscribe('SPACE_REMOVE_PLUGIN', ({ pluginType }) => applyRemoved(pluginType))
    ];

    return () => stop.forEach(unsubscribe => unsubscribe());
  }, [subscriptionManager, applyAdded, applyUpdated, applyRemoved]);

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
      if (!response.result) {
        return false;
      }

      applyRemoved(pluginType);

      return true;
    },
    [mutate, applyRemoved]
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
      Object.keys(components.current)
        .filter(compKey => components.current[compKey].origin === 'local-custom')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [components.current]
  );

  const assetsState = useMemo(
    () => ({ ...pluginStyleAssets, ...pluginCustomStyleAssets, ...temporalCustomStyles }),
    [pluginStyleAssets, pluginCustomStyleAssets, temporalCustomStyles]
  );

  const pluginSettingsStyles = useMemo(() => {
    const style: Record<string, string[]> = {};
    Object.values(plugins).forEach(plugin => {
      const { subPlugins, type, assetsSettings = [] } = plugin;
      const pluginAssets = assetsSettings.filter(asset => asset.type === 'link').map(asset => asset.params.href);
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
      assets: assetsState,
      plugins,
      dispatchPlugins,
      add,
      setSettings: setPluginSettings,
      getSettings: getPluginSettings,
      update,
      remove,
      registerCustomAssets,
      unregisterCustomAssets,
      pluginSettingsStyles
    }),
    [
      assetsState,
      plugins,
      dispatchPlugins,
      add,
      registerCustomAssets,
      unregisterCustomAssets,
      setPluginSettings,
      getPluginSettings,
      update,
      remove,
      pluginSettingsStyles
    ]
  );

  return <PluginsContext value={pluginsContextValue}>{children}</PluginsContext>;
};

export default PluginsContextProvider;
