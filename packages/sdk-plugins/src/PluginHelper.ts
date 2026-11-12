import { get, omit } from '@plitzi/plitzi-ui/helpers';

import { fetchManifest } from '@plitzi/sdk-shared/helpers';

import manifestAssetToAsset from './helpers/manifestAssetToAsset';

import type { PluginManifest, ComponentDefinition, ComponentPlugin, PluginRaw, Asset } from '@plitzi/sdk-shared';

const getComponentDefinition = (
  pluginRaw: PluginRaw,
  pluginManifest: PluginManifest
): Record<string, ComponentDefinition> => {
  try {
    const { resource, settings, type } = pluginRaw;
    const {
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
      assetsSettings,
      pluginSchema
    } = pluginManifest;

    const componentDefinitions = Object.values(get(pluginManifest, 'pluginSchema', {})).reduce((acum, component) => {
      const { definition, builder, defaultStyle, attributes, contentAttributes } = component;
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
          ...(contentAttributes ? { contentAttributes } : {}),
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
          assetsSettings: Object.values(assetsSettings)
            .filter(({ src }) => {
              if (!src) {
                return false;
              }

              return ['.css', '.js', '.mjs', '.cjs'].some(ext => src.endsWith(ext));
            })
            .map(manifestAsset => manifestAssetToAsset(resource, manifestAsset, true)),
          assets: Object.values(assets)
            .filter(({ src }) => {
              if (!src) {
                return false;
              }

              return ['.css', '.js', '.mjs', '.cjs'].some(ext => src.endsWith(ext));
            })
            .map(manifestAsset => manifestAssetToAsset(resource, manifestAsset)),
          subPlugins
        }
      };
    }, {});

    return componentDefinitions;
  } catch {
    return {};
  }
};

export const fetchPluginsManifests = async (manifests: string[]) => {
  if (!Array.isArray(manifests) || manifests.length === 0) {
    return {};
  }

  const promises = manifests.map(pluginManifest => fetchManifest<PluginManifest>(pluginManifest));
  const responses = await Promise.allSettled(promises);

  return responses.reduce<Record<string, PluginManifest>>((acum, response) => {
    if (response.status === 'fulfilled' && response.value) {
      return { ...acum, [get(response.value, 'root', '')]: response.value };
    }

    return acum;
  }, {});
};

export const pluginParseDefinition = async (pluginsRaw: PluginRaw | PluginRaw[] = []) => {
  let definitions: Record<string, ComponentDefinition> = {};
  if (!Array.isArray(pluginsRaw)) {
    return definitions;
  }

  const pluginManifests = await fetchPluginsManifests(
    pluginsRaw
      .filter(plugin => plugin.resource)
      .reduce<string[]>((acum, plugin) => [...acum, `${plugin.resource}/plugin-manifest.json`], [])
  );

  pluginsRaw.forEach(pluginRaw => {
    const { type } = pluginRaw;
    const manifest = get(pluginManifests, type);
    definitions = { ...definitions, ...getComponentDefinition(pluginRaw, manifest) };
  });

  return definitions;
};

export const getStyle = (plugins: Record<string, Pick<ComponentDefinition, 'assets'>>): Record<string, Asset> =>
  Object.values(plugins).reduce(
    (acum, plugin) => ({
      ...acum,
      // Read off the value itself: a registered component is a function, which a path reader (`get`) does not walk.
      ...(Array.isArray(plugin.assets) ? plugin.assets : [])
        .filter(asset => asset.type === 'link')
        .reduce((acum2, asset) => ({ ...acum2, [btoa(asset.id)]: asset }), {})
    }),
    {}
  );

/**
 * The stylesheets of the plugins a host hands over in its own code (`origin: 'local-custom'`), as `getStyle` reads a
 * space's: each `link` asset, by its id. The registry holds every component; only those carry stylesheets of their own.
 */
export const getLocalCustomStyle = (
  components: Record<string, Pick<ComponentPlugin, 'assets' | 'origin'>>
): Record<string, Asset> =>
  getStyle(
    Object.fromEntries(Object.entries(components).filter(([, component]) => component.origin === 'local-custom'))
  );
