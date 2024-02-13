import set from 'lodash/set';
import get from 'lodash/get';
import omit from 'lodash/omit';
import axios from 'axios';

const getComponentDefinition = (pluginRaw, pluginManifest, parentPluginRaw) => {
  const { name, description, type, market } = pluginRaw;
  const categoryName = get(market, 'category.name', 'Unknown');
  const { definition, builder, bindingsAllowed, defaultStyle } = pluginManifest;
  const componentDefinition = {
    name,
    description,
    attributes: {},
    definition: {
      label: name,
      type,
      items: [],
      bindings: {},
      styleSelectors: {
        base: ''
      }
    },
    market: {
      ...omit(market, ['category']),
      category: categoryName
    },
    builder,
    bindingsAllowed,
    defaultStyle,
    settings: {}
  };

  if (!Array.isArray(get(definition, 'items'))) {
    delete componentDefinition.definition.items;
  }

  if (parentPluginRaw) {
    let market = {};
    if ('plugin' in parentPluginRaw) {
      market = get(parentPluginRaw, 'plugin.market', {});
    } else {
      market = get(parentPluginRaw, 'market', {});
    }

    const categoryName = get(market, 'category.name', 'Unknown');

    return {
      ...componentDefinition,
      market: {
        ...omit(market, ['category']),
        category: categoryName
      }
    };
  }

  return componentDefinition;
};

const pluginChildrenParseDefinition = (parentPluginRaw, pluginsChildrenRaw, pluginManifests) => {
  if (!Array.isArray(pluginsChildrenRaw)) {
    pluginsChildrenRaw = [pluginsChildrenRaw];
  }

  let definitions = {};
  pluginsChildrenRaw
    .filter(pluginRaw => pluginManifests[pluginRaw.type])
    .forEach(pluginRaw => {
      const { type, pluginChildren } = pluginRaw;
      definitions[type] = getComponentDefinition(pluginRaw, pluginManifests[type], parentPluginRaw);
      if (pluginChildren && pluginChildren.length > 0) {
        const children = pluginChildrenParseDefinition(parentPluginRaw, pluginChildren, pluginManifests);
        set(definitions, `${type}.builder.pluginChildren`, Object.keys(children));
        definitions = { ...definitions, ...children };
      }
    });

  return definitions;
};

export const pluginCompactDefinition = pluginRaw => {
  const {
    plugin: { type, name, description, market, latestVersion },
    revisionInstalled: { assets, scope, module, version },
    settings,
    subPlugins
  } = pluginRaw;

  return { type, name, description, market, assets, scope, module, settings, version, latestVersion, subPlugins };
};

export const fetchPluginsManifest = async manifests => {
  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {};
  }

  const promises = manifests.map(async pluginManifest =>
    axios.request({ url: pluginManifest, method: 'get', headers: { 'Content-Type': 'application/json' } })
  );

  const responses = await Promise.allSettled(promises);

  return responses
    .filter(response => response.status === 'fulfilled')
    .reduce((acum, response) => ({ ...acum, ...get(response, 'value.data.pluginSchema', {}) }), {});
};

export const pluginParseDefinition = async pluginsRaw => {
  if (!Array.isArray(pluginsRaw)) {
    pluginsRaw = [pluginsRaw];
  }

  const pluginManifests = await fetchPluginsManifest(
    pluginsRaw
      .filter(plugin => !!get(plugin, 'revisionInstalled.manifestUrl'))
      .reduce((acum, plugin) => [...acum, plugin.revisionInstalled.manifestUrl], [])
  );

  let definitions = {};
  pluginsRaw
    .filter(pluginRaw => pluginManifests[pluginRaw.plugin.type])
    .forEach(pluginRaw => {
      const {
        plugin: { type, pluginChildren }
      } = pluginRaw;
      definitions[type] = getComponentDefinition(pluginRaw.plugin, pluginManifests[type]);
      if (pluginChildren && pluginChildren.length > 0) {
        const children = pluginChildrenParseDefinition(pluginRaw, pluginChildren, pluginManifests);
        set(definitions, `${type}.builder.pluginChildren`, Object.keys(children));
        definitions = { ...definitions, ...children };
      }
    });

  return definitions;
};
