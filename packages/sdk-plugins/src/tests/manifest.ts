import type { PluginManifest, PluginRaw, PluginSchema } from '@plitzi/sdk-shared';

/** A plugin's component as its manifest declares it: only what `getComponentDefinition` reads is filled. */
const component = (type: string): PluginSchema =>
  ({
    definition: { type, label: type },
    builder: {},
    defaultStyle: {},
    attributes: { title: type }
  }) as unknown as PluginSchema; // A schema's other fields are the builder's; what the helper reads is these.

/** A manifest of a plugin of `type` with a second component, its assets and its settings' assets. */
export const manifestOf = (root: string, type: string, overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  assets: {
    main: { src: 'main.js', type: 'script', isMain: true },
    style: { src: 'style.css', type: 'style' },
    map: { src: 'main.js.map', type: 'script' },
    empty: { type: 'script' }
  },
  assetsSettings: { settings: { src: 'settings.mjs', type: 'script', isMain: true } },
  author: 'Ana',
  definition: {
    name: 'Charts',
    backgroundColor: '#123456',
    category: 'data',
    icon: 'https://example.com/icon.svg',
    license: 'MIT',
    owner: 'Ana',
    verified: true,
    website: 'https://example.com'
  },
  pluginSchema: { [type]: component(type), [`${type}Legend`]: component(`${type}Legend`) },
  root,
  runtime: { module: './main', scope: type },
  created: '2026-11-10T00:00:00Z',
  updated: '2026-11-10T00:00:00Z',
  version: '1.0.0',
  ...overrides
});

export const rawOf = (type: string, resource = `https://cdn.example.com/${type}`): PluginRaw => ({
  resource,
  settings: { theme: 'dark' },
  type
});
