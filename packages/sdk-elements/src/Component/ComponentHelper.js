// Relatives
import withElement from '../Element/hocs/withElement.js';

export const ORIGIN_LOCAL = 'local';
export const ORIGIN_LOCAL_CUSTOM = 'local-custom';
export const ORIGIN_REMOTE = 'remote';

// Generic methods

export const getPlugins = (component, origin) => {
  let result = {};
  if (!component) {
    return result;
  }

  result[component.type] = component;
  const { plugins } = component;
  if (plugins && Object.keys(plugins).length > 0) {
    Object.keys(plugins).forEach(pluginKey => {
      result = { ...result, ...getPlugins(plugins[pluginKey], origin) };
    });
  }

  return result;
};

// Local

export const processLocalPlugins = plugins => {
  let pluginsProcessed = {};
  Object.values(plugins)
    .filter(comp => !!comp.type)
    .forEach(comp => {
      pluginsProcessed = { ...pluginsProcessed, ...getPlugins(comp, ORIGIN_LOCAL) };
    });

  return pluginsProcessed;
};

// Local Custom Components

export const nestedInject = (plugins, origin) => {
  if (!plugins) {
    return {};
  }

  const pluginsProcessed = {};
  Object.keys(plugins).forEach(pluginType => {
    const plugin = plugins[pluginType];
    const { version, pluginSettings, initialItems, plugins: subPlugins } = plugin;
    pluginsProcessed[pluginType] = withElement(plugin);
    pluginsProcessed[pluginType].origin = origin;
    pluginsProcessed[pluginType].version = version;
    pluginsProcessed[pluginType].type = pluginType;
    pluginsProcessed[pluginType].initialItems = initialItems;
    pluginsProcessed[pluginType].pluginSettings = pluginSettings;
    pluginsProcessed[pluginType].plugins = nestedInject(subPlugins, origin);
  });

  return pluginsProcessed;
};

export const processLocalCustomPlugins = localComponents => {
  let pluginsProcessed = {};
  Object.values(localComponents)
    .filter(comp => !!comp.type)
    .forEach(comp => {
      const { type, pluginSettings, version, initialItems, plugins, assets, content } = comp;
      const plitziComponent = withElement(comp);
      plitziComponent.version = version;
      plitziComponent.type = type;
      plitziComponent.assets = assets;
      plitziComponent.initialItems = initialItems;
      plitziComponent.pluginSettings = pluginSettings;
      plitziComponent.origin = ORIGIN_LOCAL_CUSTOM;
      plitziComponent.content = content;
      plitziComponent.plugins = nestedInject(plugins, ORIGIN_LOCAL_CUSTOM);

      pluginsProcessed = { ...pluginsProcessed, ...getPlugins(plitziComponent) };
    });

  return pluginsProcessed;
};

// Remote Custom Components
