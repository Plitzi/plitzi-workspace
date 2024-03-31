// Packages
import get from 'lodash/get';
import omit from 'lodash/omit';

const getComponentDefinition = (pluginRaw, pluginManifest) => {
  try {
    const { resource, settings, type } = pluginRaw;
    const {
      runtime: { scope = '', module = '' },
      definition: {
        name = "Plitzi's Demo Plugin",
        // description = '',
        owner = 'Plitzi',
        verified = false,
        license = 'MIT',
        website = 'https://plitzi.com',
        backgroundColor = '#4422ee',
        icon = 'https://cdn.plitzi.com/resources/img/favicon.svg'
      },
      assets,
      pluginSchema
    } = pluginManifest;

    const componentDefinitions = Object.values(get(pluginManifest, 'pluginSchema', {})).reduce((acum, component) => {
      const { definition, builder, bindingsAllowed, defaultStyle, attributes } = component;
      let subPlugins = [];
      if (definition.type === type) {
        subPlugins = Object.keys(omit(pluginSchema, [type]));
      }

      return {
        ...acum,
        [definition.type]: {
          // Builder
          attributes,
          bindingsAllowed,
          builder,
          defaultStyle,
          definition,
          market: { owner, verified, license, website, backgroundColor, icon, category: name },
          // Builder - Resources
          resource,
          isMain: definition.type === type,
          manifest: pluginManifest,
          type,
          // SDK
          settings,
          assets: Object.values(assets).map(asset => ({ type: asset.type, url: `${resource}/${asset.src}` })),
          scope,
          module,
          subPlugins
        }
      };
    }, {});

    return componentDefinitions;
  } catch (e) {
    return {};
  }
};

const getCompactComponentDefinition = (pluginRaw, pluginManifest) => {
  const { resource, settings, type } = pluginRaw;
  const { runtime: { scope, module } = {}, assets, pluginSchema } = pluginManifest;

  return {
    assets: Object.values(assets).map(asset => ({ type: asset.type, url: `${resource}/${asset.src}` })),
    scope,
    module,
    settings,
    subPlugins: Object.keys(omit(pluginSchema, [type]))
  };
};

export const fetchPluginsManifest = async manifests => {
  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {};
  }

  const promises = manifests.map(async pluginManifest =>
    fetch(pluginManifest, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  );

  const responses = await Promise.allSettled(promises);

  return responses
    .filter(response => response.status === 'fulfilled')
    .reduce(async (acum, response) => {
      const manifestData = (await response.value?.json()) || {};

      return { ...acum, [get(manifestData, 'root', '')]: manifestData };
    }, {});
};

export const pluginParseDefinition = async (pluginsRaw, compact = false) => {
  if (!Array.isArray(pluginsRaw)) {
    pluginsRaw = [pluginsRaw];
  }

  const pluginManifests = await fetchPluginsManifest(
    pluginsRaw.reduce((acum, plugin) => [...acum, `${plugin.resource}/plugin-manifest.json`], [])
  );

  let definitions = {};
  pluginsRaw
    .filter(pluginRaw => get(pluginManifests, pluginRaw.type))
    .forEach(pluginRaw => {
      const { type } = pluginRaw;
      const manifest = get(pluginManifests, type);
      if (compact) {
        definitions[type] = getCompactComponentDefinition(pluginRaw, manifest);
      } else {
        definitions = { ...definitions, ...getComponentDefinition(pluginRaw, manifest) };
      }
    });

  return definitions;
};
