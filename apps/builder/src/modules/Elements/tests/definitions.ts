import type { ComponentDefinition, PluginManifest } from '@plitzi/sdk-shared';

const MANIFEST: PluginManifest = {
  assets: {},
  assetsSettings: {},
  author: 'Plitzi',
  definition: {
    name: 'Elements',
    backgroundColor: '#000000',
    category: 'basic',
    icon: '',
    license: 'MIT',
    owner: 'Plitzi',
    verified: true,
    website: 'https://plitzi.com'
  },
  pluginSchema: {},
  root: '',
  runtime: { module: './main', scope: 'elements' },
  created: '2026-11-11T00:00:00Z',
  updated: '2026-11-11T00:00:00Z',
  version: '1.0.0'
};

/** An element of the catalog as the panel reads one: its type, label, category, and what it starts with. */
export const definitionOf = (
  type: string,
  {
    label = type,
    category = 'basic',
    description,
    items,
    initialItems,
    canDragDrop
  }: {
    label?: string;
    category?: string;
    description?: string;
    items?: string[];
    initialItems?: string[];
    canDragDrop?: boolean;
  } = {}
): ComponentDefinition => ({
  type,
  attributes: {},
  defaultStyle: {
    name: type,
    displayMode: 'desktop',
    style: {},
    bindingsAllowed: { attributes: [], initialState: [] }
  },
  builder: canDragDrop === undefined ? {} : { canDragDrop },
  definition: {
    type,
    label,
    rootId: '',
    styleSelectors: { base: '' },
    ...(items ? { items } : {}),
    ...(description ? { description } : {})
  },
  ...(initialItems ? { initialItems } : {}),
  assets: [],
  assetsSettings: [],
  manifest: MANIFEST,
  market: { ...MANIFEST, category },
  settings: {},
  subPlugins: [],
  resource: '',
  module: './main',
  scope: 'elements'
});
