import withElement from '../Element/hocs/withElement';

import type { ComponentOrigin, ComponentPlugin } from '@plitzi/sdk-shared';

export const ORIGIN_LOCAL = 'local';
export const ORIGIN_LOCAL_CUSTOM = 'local-custom';
export const ORIGIN_REMOTE = 'remote';

// Generic methods

export const getPlugins = (component: ComponentPlugin | undefined) => {
  let result: Record<string, ComponentPlugin> = {};
  if (!component) {
    return result;
  }

  result[component.type] = component;
  const { plugins } = component;
  if (plugins && Object.keys(plugins).length > 0) {
    Object.keys(plugins).forEach(pluginKey => {
      result = { ...result, ...getPlugins(plugins[pluginKey]) };
    });
  }

  return result;
};

// Local

export const processLocalPlugins = (plugins: Record<string, ComponentPlugin>) => {
  let pluginsProcessed = {};
  Object.values(plugins).forEach(comp => {
    if (comp.type) {
      pluginsProcessed = { ...pluginsProcessed, ...getPlugins(comp) };
    }
  });

  return pluginsProcessed;
};

// Local Custom Components

export const nestedInject = (plugins: Record<string, ComponentPlugin> | undefined, origin: ComponentOrigin) => {
  if (!plugins) {
    return {};
  }

  const pluginsProcessed: Record<string, ComponentPlugin> = {};
  Object.keys(plugins).forEach(pluginType => {
    const plugin = plugins[pluginType];
    const { version, pluginSettings, initialItems, plugins: subPlugins } = plugin;
    pluginsProcessed[pluginType] = withElement(plugin) as ComponentPlugin;
    pluginsProcessed[pluginType].origin = origin;
    pluginsProcessed[pluginType].version = version;
    pluginsProcessed[pluginType].type = pluginType;
    pluginsProcessed[pluginType].initialItems = initialItems;
    pluginsProcessed[pluginType].pluginSettings = pluginSettings;
    pluginsProcessed[pluginType].plugins = nestedInject(subPlugins, origin);
  });

  return pluginsProcessed;
};

export const processLocalCustomPlugins = (localComponents: Record<string, ComponentPlugin>) => {
  let pluginsProcessed = {};
  Object.values(localComponents).forEach(comp => {
    if (!comp.type) {
      return;
    }

    const { type, pluginSettings, version, initialItems, plugins, assets, content } = comp;
    const plitziComponent = withElement(comp) as ComponentPlugin;
    plitziComponent.version = version;
    plitziComponent.type = type;
    plitziComponent.assets = assets;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.origin = ORIGIN_LOCAL_CUSTOM;
    plitziComponent.content = content;
    plitziComponent.plugins = nestedInject(plugins, 'local-custom');

    pluginsProcessed = { ...pluginsProcessed, ...getPlugins(plitziComponent) };
  });

  return pluginsProcessed;
};

// Remote Custom Components
