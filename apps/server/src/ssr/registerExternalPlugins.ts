import type { PluginManager } from '../plugins/manager';
import type { PluginSourceFile } from '../types';
import type { OfflineDataRaw, PluginManifest, PluginRaw } from '@plitzi/sdk-shared';

const fetchManifest = async (resource: string): Promise<PluginManifest | null> => {
  try {
    const url = `${resource}/plugin-manifest.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[SSR] Failed to fetch plugin manifest from ${url}: HTTP ${res.status}`);
      return null;
    }

    return (await res.json()) as PluginManifest;
  } catch (err) {
    console.warn(`[SSR] Error fetching plugin manifest from ${resource}:`, err);
    return null;
  }
};

const resolveAssetUrl = (resource: string, asset: PluginManifest['assets'][string]): string | null => {
  if (asset.url) return asset.url;
  if (asset.src) return `${resource}/${asset.src}`;
  return null;
};

const findAsset = (
  manifest: PluginManifest,
  type: 'script' | 'style',
  resource: string
): string | undefined => {
  const assets = Object.values(manifest.assets);
  const main = assets.find(a => a.type === type && a.isMain) ?? assets.find(a => a.type === type);
  return main ? (resolveAssetUrl(resource, main) ?? undefined) : undefined;
};

const registerPlugin = async (pluginManager: PluginManager, plugin: PluginRaw): Promise<string | null> => {
  const manifest = await fetchManifest(plugin.resource);
  if (!manifest) {
    return null;
  }

  const jsUrl = findAsset(manifest, 'script', plugin.resource);
  if (!jsUrl) {
    console.warn(`[SSR] Plugin "${plugin.type}" has no JS asset in manifest, skipping`);
    return null;
  }

  const source: PluginSourceFile = {
    js: jsUrl,
    css: findAsset(manifest, 'style', plugin.resource),
    action: 'download',
    version: manifest.version
  };

  return pluginManager.ensure(plugin.type, source);
};

/**
 * Reads plugins listed in offlineData.plugins, fetches their manifests, downloads and caches
 * JS/CSS via the PluginManager, and returns the effective plugin keys to pass to getEntries().
 */
export const registerExternalPlugins = async (
  pluginManager: PluginManager,
  offlineData: OfflineDataRaw | undefined
): Promise<string[]> => {
  const plugins = offlineData?.plugins;
  if (!plugins || plugins.length === 0) {
    return [];
  }

  const results = await Promise.all(plugins.map(p => registerPlugin(pluginManager, p)));
  return results.filter((k): k is string => k !== null);
};
