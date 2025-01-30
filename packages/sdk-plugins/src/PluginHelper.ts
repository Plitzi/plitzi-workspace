// Packages
import get from 'lodash/get';
import omit from 'lodash/omit';

// Types
import type { PluginManifest, Plugin, ComponentDefinition } from './PluginsContext';

export type PluginRaw = {
  resource: string;
  settings: Plugin['settings'];
  type: string;
};

const getComponentDefinition = (
  pluginRaw: PluginRaw,
  pluginManifest: PluginManifest
): Record<string, ComponentDefinition> => {
  try {
    const { resource, settings, type } = pluginRaw;
    const {
      runtime: { scope = '', module = '' },
      definition: {
        // eslint-disable-next-line quotes
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
      const { definition, builder, defaultStyle, attributes } = component;
      let subPlugins: string[] = [];
      if (definition.type === type) {
        subPlugins = Object.keys(omit(pluginSchema, [type]));
      }

      return {
        ...acum,
        [definition.type]: {
          // Builder
          attributes,
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
  } catch {
    return {} as Record<string, ComponentDefinition>;
  }
};

const getCompactComponentDefinition = (pluginRaw: PluginRaw, pluginManifest: PluginManifest) => {
  const { resource, settings, type } = pluginRaw;
  const { runtime: { scope, module } = {}, assets, pluginSchema } = pluginManifest;

  return {
    assets: Object.values(assets).map(asset => ({ type: asset.type, url: `${resource}/${asset.src}` })),
    scope,
    module,
    settings,
    subPlugins: Object.keys(omit(pluginSchema, [type]))
  } as Partial<ComponentDefinition>;
};

const fetchPluginsManifest = async (pluginManifest: string) => {
  let responseContent: PluginManifest | undefined;
  try {
    const response = await fetch(pluginManifest, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    responseContent = (await response.json()) as PluginManifest;

    return responseContent;
  } catch {
    return responseContent;
  }
};

export const fetchPluginsManifests = async (manifests: string[]) => {
  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {};
  }

  const promises = manifests.map(pluginManifest => fetchPluginsManifest(pluginManifest));
  const responses = await Promise.allSettled(promises);

  return responses.reduce((acum, response) => {
    if (response.status === 'fulfilled' && response.value) {
      return { ...acum, [get(response.value, 'root', '')]: response.value };
    }

    return acum;
  }, {}) as Record<string, PluginManifest>;
};

export const pluginParseDefinition = async (pluginsRaw: PluginRaw[] = [], compact = false) => {
  let definitions: Record<string, ComponentDefinition | Partial<ComponentDefinition>> = {};
  if (!Array.isArray(pluginsRaw)) {
    return definitions;
  }

  const pluginManifests = await fetchPluginsManifests(
    pluginsRaw.reduce<string[]>((acum, plugin) => [...acum, `${plugin.resource}/plugin-manifest.json`], [])
  );

  pluginsRaw.forEach(pluginRaw => {
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
