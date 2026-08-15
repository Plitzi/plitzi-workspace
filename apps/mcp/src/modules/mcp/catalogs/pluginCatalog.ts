import type { ComponentCatalog, ComponentCatalogEntry, PluginManifest, PluginSchema } from '@plitzi/sdk-shared';

/**
 * The catalog entries for a space's PLUGIN (custom) element types, read from each plugin's published manifest.
 *
 * All of this was consumer code, in every deployment that served plugins: fetch `<resource>/plugin-manifest.json`,
 * cache it, then walk the manifest into a `ComponentCatalogEntry`. None of it is a deployment's own knowledge —
 * `PluginManifest` and `ComponentCatalogEntry` are both shared types and the mapping between them has one right
 * answer, which is what makes it this package's. What a deployment knows, and all it now supplies, is which plugins
 * the space has.
 *
 * The BUILT-IN types are not here: their structural half (attributes, style selectors, default styles) comes from
 * `@plitzi/sdk-elements`, which this package deliberately does not depend on — a React element library is the
 * heaviest possible import for a server that renders nothing. Deployments merge those in themselves; the curated
 * semantics for them live in `builtinComponents.ts`.
 */

// Plugin resources are versioned, immutable URLs, so their manifests are safe to hold. A short TTL is what keeps a
// "latest"-style resource from going stale for long.
const MANIFEST_TTL_MS = 10 * 60 * 1000;

type ManifestCacheEntry = { manifest: PluginManifest | null; expiresAt: number };

const manifestCache = new Map<string, ManifestCacheEntry>();

const fetchManifest = async (resource: string): Promise<PluginManifest | null> => {
  const cached = manifestCache.get(resource);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.manifest;
  }

  let manifest: PluginManifest | null = null;
  try {
    const res = await fetch(`${resource}/plugin-manifest.json`);
    if (res.ok) {
      manifest = (await res.json()) as PluginManifest;
    }
  } catch {
    // An unreachable plugin host must not fail the catalog: the type still exists in the schema, it just arrives
    // without metadata. Cached as a null so one dead resource is not re-fetched on every read.
    manifest = null;
  }

  manifestCache.set(resource, { manifest, expiresAt: Date.now() + MANIFEST_TTL_MS });

  return manifest;
};

const strOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const keysOf = (record: Record<string, unknown> | undefined): string[] => (record ? Object.keys(record) : []);

/** `bindingsAllowed` stores each target as `{ path, label }`; the catalog only needs the paths. */
const pathsOf = (list: { path: string }[] | undefined): string[] | undefined =>
  list && list.length > 0 ? list.map(item => item.path) : undefined;

/**
 * Keeps only string css declarations from a `base.default` block — dropping nested states and variants, and any
 * non-scalar value — so the catalog carries a flat `prop: value` map an agent can read as the element's starting
 * styles.
 */
export const stringDeclarations = (block: Record<string, unknown> | undefined): Record<string, string> | undefined => {
  if (!block) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [prop, value] of Object.entries(block)) {
    if (typeof value === 'string') {
      out[prop] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
};

const entryFromManifest = (type: string, manifest: PluginManifest): ComponentCatalogEntry => {
  // A manifest may not carry a pluginSchema entry for every type it declares, so the index access is nullable.
  const pluginSchema = manifest.pluginSchema[type] as PluginSchema | undefined;
  const elementDef = pluginSchema?.definition;
  // `label` is typed on the element definition; `description` is carried at runtime but absent from the shared
  // Element['definition'] type, so it is read defensively.
  const label = strOrUndefined(elementDef?.label) ?? strOrUndefined(manifest.definition.name);
  const description = strOrUndefined((elementDef as { description?: unknown } | undefined)?.description);
  const bindingsAllowed = pluginSchema?.defaultStyle.bindingsAllowed;
  const attributesTargets = pathsOf(bindingsAllowed?.attributes);
  const initialStateTargets = pathsOf(bindingsAllowed?.initialState);
  // A manifest is an untrusted external JSON snapshot: its `defaultStyle.style` may be absent, so read the base
  // declarations through a fully-optional view rather than trusting the required PluginSchema shape.
  const pluginBase = (
    pluginSchema?.defaultStyle as { style?: { base?: { default?: Record<string, unknown> } } } | undefined
  )?.style?.base?.default;
  const defaultStyle = stringDeclarations(pluginBase);

  return {
    label,
    description,
    category: strOrUndefined(manifest.definition.category),
    custom: true,
    attributes: keysOf(pluginSchema?.attributes),
    styleSelectors: keysOf(elementDef?.styleSelectors),
    ...(defaultStyle ? { defaultStyle } : {}),
    ...(attributesTargets || initialStateTargets
      ? { bindingsAllowed: { attributes: attributesTargets, initialState: initialStateTargets } }
      : {})
  };
};

/**
 * Builds the plugin half of a component catalog from a space's installed plugins, keyed by schema `type`.
 *
 * A plugin whose manifest cannot be read yields `{ custom: true }` with no metadata rather than failing the whole
 * catalog — the agent then sees the type exists but learns nothing more about it, which is strictly better than
 * being told the space has no plugins at all.
 */
export const pluginCatalog = async (
  plugins: Record<string, { resource: string }> | undefined
): Promise<ComponentCatalog> => {
  const catalog: ComponentCatalog = {};
  if (!plugins) {
    return catalog;
  }

  const entries = await Promise.all(
    Object.entries(plugins).map(async ([type, { resource }]): Promise<[string, ComponentCatalogEntry]> => {
      const manifest = await fetchManifest(resource);

      return [type, manifest ? entryFromManifest(type, manifest) : { custom: true }];
    })
  );

  for (const [type, entry] of entries) {
    catalog[type] = entry;
  }

  return catalog;
};
