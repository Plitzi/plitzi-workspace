export const pluginResource = {
  uri: 'plitzi://docs/plugin',
  name: 'Plitzi Docs: Plugin',
  description:
    'An external UI component definition in Plitzi — a packaged React component with manifest, assets, and builder constraints.',
  mimeType: 'text/markdown',
  content: `# Plugin

A **Plugin** is a packaged UI component definition loaded into a Plitzi space. Plugins provide the React component code that renders elements.

**Important distinction:** A *plugin* is what you install in a space. An *element type identifier* is what you pass as \`type\` when creating elements. The two are related (each plugin exposes one or more element types), but they are accessed differently:
- \`list_plugins\` returns installed plugins with their name, version, and description — it does NOT return element type identifiers.
- Element type identifiers are the keys of \`elementDefaults\` in \`get_builder_context\`, or the \`type\` field on existing elements from \`get_schema\`.

## TypeScript Shape

\`\`\`typescript
type Plugin = {
  type: string;              // Plugin type ID — matches element.definition.type
  scope: string;             // Module federation scope name
  module: string;            // Module federation module name
  resource: string;          // CDN URL of the plugin bundle
  manifest: PluginManifest;
  assets: Asset[];
  assetsSettings: Asset[];
  attributes: ComponentDefinition['attributes'];   // Attribute schema
  defaultStyle: ComponentDefinition['defaultStyle'];
  builder: PluginBuilder;    // Visual editor constraints
  settings: Record<string, unknown>;
  subPlugins?: string[];     // Other plugin types this can contain
  isMain?: boolean;
};

type PluginManifest = {
  version: string;
  author: string;
  icon?: string;
  definition: {
    name: string;
    backgroundColor: string;
    category: string;
    icon: string;
    license: string;
    owner: string;
    verified: boolean;
    website: string;
  };
  pluginSchema: Record<string, PluginSchema>;  // Schema per subType
  assets: Record<string, ManifestAsset>;
  assetsSettings: Record<string, ManifestAsset>;
  root: string;
  runtime: { module: string; scope: string };
  created: string;
  updated: string;
};

type PluginBuilder = {
  canDelete?: boolean;
  canDragDrop?: boolean;
  canSelect?: boolean;
  canMove?: boolean;
  canTemplate?: boolean;
  itemsAllowed?: string[];      // Which plugin types can be children
  itemsNotAllowed?: string[];
};
\`\`\`

## Key Properties

- **\`type\`** — internal identifier that links this plugin to elements. When an element has \`definition.type === plugin.type\`, that plugin renders it. You do not reference this directly — use \`elementDefaults\` keys from \`get_builder_context\` to get valid element type values.
- **\`manifest.pluginSchema\`** — per-subType attribute schema. Controls what fields appear in the builder panel for each element variant (\`attributes.subType\`).
- **\`builder\`** — constraints for the visual editor. \`itemsAllowed\` restricts which plugin types can be dropped as children.
- **\`subPlugins\`** — additional plugin types bundled with this one (loaded together).
- **\`scope\` / \`module\` / \`resource\`** — Module Federation coordinates used to load the component at runtime.

## Relationship to Elements

When a page renders, each element is matched to its plugin by \`definition.type\`. The plugin provides:
1. The React component for rendering.
2. The builder UI for editing \`attributes\`.
3. The default style selectors and style structure.

## Resource Type

Plugins can also be stored as CDN **Resources** with \`type: 'plugin'\`. In that case, the resource includes a \`metadata\` field containing the \`PluginManifest\`.

## Common Operations

- \`list_plugins\` — list all plugins installed in the space.
- \`add_plugin\` — install a plugin from the resource library.
- \`update_plugin\` — update plugin settings or version.
- \`remove_plugin\` — uninstall a plugin.
`
};
