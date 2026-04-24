import type { PluginSource } from '@plitzi/sdk-shared';

const DEFAULT_PLUGIN_VERSION = '1.0.0';

export const normalizePluginSource = (source: PluginSource): PluginSource => ({
  ...source,
  version: source.version ?? DEFAULT_PLUGIN_VERSION
});

const normalizePlugins = (plugins: Record<string, PluginSource>): Record<string, PluginSource> => {
  const out: Record<string, PluginSource> = {};
  for (const [name, source] of Object.entries(plugins)) {
    const normalized = normalizePluginSource(source);
    out[`${name}@${normalized.version}`] = normalized;
  }

  return out;
};

export default normalizePlugins;
