import withElement from '../Element/hocs/withElement';

import type { ComponentOrigin, ComponentPluginWithHOC } from '@plitzi/sdk-shared';

// Generic methods

export const getPlugins = (component: ComponentPluginWithHOC | undefined) => {
  const result: Record<string, ComponentPluginWithHOC> = {};
  if (!component) {
    return result;
  }

  result[component.type] = component;
  const { plugins } = component;
  if (plugins && Object.keys(plugins).length > 0) {
    Object.keys(plugins).forEach(pluginKey => {
      Object.assign(result, getPlugins(plugins[pluginKey]));
    });
  }

  return result;
};

// Local

export const processLocalPlugins = (plugins?: Record<string, ComponentPluginWithHOC>) => {
  const pluginsProcessed: Record<string, ComponentPluginWithHOC> = {};
  if (!plugins) {
    return pluginsProcessed;
  }

  Object.values(plugins).forEach(comp => {
    if (comp.type) {
      Object.assign(pluginsProcessed, getPlugins(comp));
    }
  });

  return pluginsProcessed;
};

// Local Custom Components

/**
 * Each plugin component wrapped once, per origin. The registry is rebuilt whenever the host hands its plugins over again
 * — the root renders once more as hydration ends — and a NEW wrapper is a new component type to React: every plugin was
 * unmounted half a second after it painted, the server's HTML thrown away, its entrance replayed and its effects run
 * twice. Another component — a plugin swapped in while developing — is another key, and is wrapped anew.
 */
const wrappers: Record<ComponentOrigin, WeakMap<ComponentPluginWithHOC, ComponentPluginWithHOC>> = {
  local: new WeakMap(),
  'local-custom': new WeakMap(),
  remote: new WeakMap()
};

const wrapOnce = (component: ComponentPluginWithHOC, origin: ComponentOrigin): ComponentPluginWithHOC => {
  const known = wrappers[origin].get(component);
  if (known) {
    return known;
  }

  // `withElement` answers a component of its own kind: the statics below are set on it, as the registry reads them.
  const wrapped = withElement(component) as ComponentPluginWithHOC;
  wrappers[origin].set(component, wrapped);

  return wrapped;
};

export const nestedInject = (plugins: Record<string, ComponentPluginWithHOC> | undefined, origin: ComponentOrigin) => {
  if (!plugins) {
    return {};
  }

  const pluginsProcessed: Record<string, ComponentPluginWithHOC> = {};
  Object.keys(plugins).forEach(pluginType => {
    const plugin = plugins[pluginType];
    const { version, pluginSettings, initialItems, plugins: subPlugins, extraProps } = plugin;
    pluginsProcessed[pluginType] = wrapOnce(plugin, origin);
    pluginsProcessed[pluginType].origin = origin;
    pluginsProcessed[pluginType].version = version;
    pluginsProcessed[pluginType].type = pluginType;
    pluginsProcessed[pluginType].initialItems = initialItems;
    pluginsProcessed[pluginType].pluginSettings = pluginSettings;
    pluginsProcessed[pluginType].extraProps = extraProps;
    pluginsProcessed[pluginType].plugins = nestedInject(subPlugins, origin);
  });

  return pluginsProcessed;
};

export const processLocalCustomPlugins = (localComponents?: Record<string, ComponentPluginWithHOC>) => {
  const pluginsProcessed: Record<string, ComponentPluginWithHOC> = {};
  if (!localComponents) {
    return pluginsProcessed;
  }

  Object.values(localComponents).forEach(comp => {
    if (!comp.type) {
      return;
    }

    const { type, pluginSettings, version, initialItems, plugins, assets, content, extraProps } = comp;
    const plitziComponent = wrapOnce(comp, 'local-custom');
    plitziComponent.version = version;
    plitziComponent.type = type;
    plitziComponent.assets = assets;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.origin = 'local-custom';
    plitziComponent.content = content;
    plitziComponent.extraProps = extraProps;
    plitziComponent.plugins = nestedInject(plugins, 'local-custom');

    Object.assign(pluginsProcessed, getPlugins(plitziComponent));
  });

  return pluginsProcessed;
};
