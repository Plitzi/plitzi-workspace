import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { PluginManager } from '../../plugins/manager';
import type { OfflineDataRaw, PluginManifest, PluginRaw, PluginSourceFile } from '@plitzi/sdk-shared';

// Plugin resources are versioned (immutable) URLs, so their manifests are cached to keep the network
// fetch off the SSR critical path. The cache is stale-while-revalidate: a hit is served immediately
// (even when expired) and, if expired, refreshed in the background so moving/"latest" URLs still update
// within one render of staleness. A disk mirror survives restarts, so the fetch never blocks a render
// once a resource has been seen at least once.
const MANIFEST_TTL_MS = 10 * 60 * 1000;

type ManifestCacheEntry = { manifest: PluginManifest; expiresAt: number };

const manifestCache = new Map<string, ManifestCacheEntry>();
const refreshing = new Set<string>();

let cacheDir: string | undefined;
const manifestCacheDir = (pluginManager: PluginManager): string => {
  cacheDir ??= path.join(pluginManager.outputDir, '.manifest-cache');
  return cacheDir;
};

const cacheFilePath = (dir: string, resource: string): string =>
  path.join(dir, `${crypto.createHash('sha1').update(resource).digest('hex')}.json`);

const readDiskEntry = async (dir: string, resource: string): Promise<ManifestCacheEntry | null> => {
  try {
    const raw = await fs.readFile(cacheFilePath(dir, resource), 'utf-8');
    return JSON.parse(raw) as ManifestCacheEntry;
  } catch {
    return null;
  }
};

const writeDiskEntry = async (dir: string, resource: string, entry: ManifestCacheEntry): Promise<void> => {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(cacheFilePath(dir, resource), JSON.stringify(entry), 'utf-8');
  } catch (err) {
    console.warn(`[SSR] Failed to persist plugin manifest cache for ${resource}:`, err);
  }
};

const fetchAndStore = async (dir: string, resource: string): Promise<PluginManifest | null> => {
  try {
    const url = `${resource}/plugin-manifest.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[SSR] Failed to fetch plugin manifest from ${url}: HTTP ${res.status}`);
      return null;
    }

    const manifest = (await res.json()) as PluginManifest;
    const entry: ManifestCacheEntry = { manifest, expiresAt: Date.now() + MANIFEST_TTL_MS };
    manifestCache.set(resource, entry);
    await writeDiskEntry(dir, resource, entry);

    return manifest;
  } catch (err) {
    console.warn(`[SSR] Error fetching plugin manifest from ${resource}:`, err);
    return null;
  }
};

const revalidate = (dir: string, resource: string): void => {
  if (refreshing.has(resource)) {
    return;
  }

  refreshing.add(resource);
  void fetchAndStore(dir, resource).finally(() => refreshing.delete(resource));
};

const fetchManifest = async (pluginManager: PluginManager, resource: string): Promise<PluginManifest | null> => {
  const dir = manifestCacheDir(pluginManager);

  const cached = manifestCache.get(resource) ?? (await readDiskEntry(dir, resource)) ?? undefined;
  if (cached) {
    manifestCache.set(resource, cached);
    if (cached.expiresAt <= Date.now()) {
      revalidate(dir, resource);
    }

    return cached.manifest;
  }

  return fetchAndStore(dir, resource);
};

const resolveAssetUrl = (resource: string, asset: PluginManifest['assets'][string]): string | null => {
  if (asset.url) {
    return asset.url;
  }

  if (asset.src) {
    return `${resource}/${asset.src}`;
  }

  return null;
};

const findAsset = (manifest: PluginManifest, type: 'script' | 'style', resource: string): string | undefined => {
  const assets = Object.values(manifest.assets);
  const main = assets.find(a => a.type === type && a.isMain) ?? assets.find(a => a.type === type);
  return main ? (resolveAssetUrl(resource, main) ?? undefined) : undefined;
};

const isAbsoluteUrl = (url: string): boolean => url.startsWith('http://') || url.startsWith('https://');

const registerPlugin = async (pluginManager: PluginManager, plugin: PluginRaw): Promise<string | null> => {
  if (!plugin.resource || !isAbsoluteUrl(plugin.resource)) {
    return null;
  }

  const manifest = await fetchManifest(pluginManager, plugin.resource);
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
