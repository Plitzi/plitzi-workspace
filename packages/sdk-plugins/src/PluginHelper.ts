import get from 'lodash/get.js';
import omit from 'lodash/omit.js';

import fetchManifest from '@plitzi/sdk-shared/helpers/fetchManifest';

import type { PluginManifest, ComponentDefinition, PluginRaw, Asset } from '@plitzi/sdk-shared';

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
          assets: Object.values(assets).map<Asset>(({ src, type, isMain }) => {
            const url = `${resource}/${src}`;
            const urlEncoded = btoa(url);
            if (type === 'style') {
              return {
                type: 'link',
                id: urlEncoded,
                params: { href: url, rel: 'stylesheet', type: 'text/css' },
                isMain
              } as Asset;
            }

            return { type: 'script', id: urlEncoded, params: { src: url, type: 'text/javascript' }, isMain } as Asset;
          }),
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

export const fetchPluginsManifests = async (manifests: string[]) => {
  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {};
  }

  const promises = manifests.map(pluginManifest => fetchManifest<PluginManifest>(pluginManifest));
  const responses = await Promise.allSettled(promises);

  return responses.reduce((acum, response) => {
    if (response.status === 'fulfilled' && response.value) {
      return { ...acum, [get(response.value, 'root', '')]: response.value };
    }

    return acum;
  }, {}) as Record<string, PluginManifest>;
};

export const pluginParseDefinition = async (pluginsRaw: PluginRaw | PluginRaw[] = []) => {
  let definitions: Record<string, ComponentDefinition> = {};
  if (!Array.isArray(pluginsRaw)) {
    return definitions;
  }

  const pluginManifests = await fetchPluginsManifests(
    pluginsRaw.reduce<string[]>((acum, plugin) => [...acum, `${plugin.resource}/plugin-manifest.json`], [])
  );

  pluginsRaw.forEach(pluginRaw => {
    const { type } = pluginRaw;
    const manifest = get(pluginManifests, type);
    definitions = { ...definitions, ...getComponentDefinition(pluginRaw, manifest) };
  });

  return definitions;
};

export const getStyle = (plugins: Record<string, ComponentDefinition>): Record<string, Asset> =>
  Object.values(plugins).reduce(
    (acum, plugin) => ({
      ...acum,
      ...get(plugin, 'assets', [])
        .filter(asset => asset.type === 'link')
        .reduce((acum2, asset) => ({ ...acum2, [btoa(asset.id)]: asset }), {})
    }),
    {}
  );
