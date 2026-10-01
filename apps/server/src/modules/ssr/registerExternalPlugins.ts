import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { writeFileAtomic } from '../../helpers/atomicFile';
import { fetchOutbound } from '../../helpers/outboundGuard';
import { serverLog } from '../../helpers/serverLog';

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
    await writeFileAtomic(cacheFilePath(dir, resource), JSON.stringify(entry));
  } catch (err) {
    serverLog.warn('SSR', `Failed to persist plugin manifest cache for ${resource}`, err);
  }
};

/** Where a plugin may be read from: anywhere public, and — on a development machine only — a private address too. */
type ManifestReach = { allowPrivateHosts: boolean };

const fetchAndStore = async (dir: string, resource: string, reach: ManifestReach): Promise<PluginManifest | null> => {
  try {
    const url = `${resource}/plugin-manifest.json`;
    // The resource is written by whoever edits the space and fetched from inside the cluster, so it answers to the
    // same outbound rule as a flow's `http.request`; a refusal lands in the catch below like any other failed fetch.
    const res = reach.allowPrivateHosts ? await fetch(url) : await fetchOutbound(fetch, new URL(url));
    if (!res.ok) {
      serverLog.warn('SSR', `Failed to fetch plugin manifest from ${url}: HTTP ${res.status}`);
      return null;
    }

    const manifest = (await res.json()) as PluginManifest;
    const entry: ManifestCacheEntry = { manifest, expiresAt: Date.now() + MANIFEST_TTL_MS };
    manifestCache.set(resource, entry);
    await writeDiskEntry(dir, resource, entry);

    return manifest;
  } catch (err) {
    serverLog.warn('SSR', `Error fetching plugin manifest from ${resource}`, err);
    return null;
  }
};

const revalidate = (dir: string, resource: string, reach: ManifestReach): void => {
  if (refreshing.has(resource)) {
    return;
  }

  refreshing.add(resource);
  void fetchAndStore(dir, resource, reach).finally(() => refreshing.delete(resource));
};

const fetchManifest = async (
  pluginManager: PluginManager,
  resource: string,
  reach: ManifestReach
): Promise<PluginManifest | null> => {
  const dir = manifestCacheDir(pluginManager);

  const cached = manifestCache.get(resource) ?? (await readDiskEntry(dir, resource)) ?? undefined;
  if (cached) {
    manifestCache.set(resource, cached);
    if (cached.expiresAt <= Date.now()) {
      revalidate(dir, resource, reach);
    }

    return cached.manifest;
  }

  return fetchAndStore(dir, resource, reach);
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

const registerPlugin = async (
  pluginManager: PluginManager,
  plugin: PluginRaw,
  reach: ManifestReach
): Promise<string | null> => {
  if (!plugin.resource || !isAbsoluteUrl(plugin.resource)) {
    return null;
  }

  const manifest = await fetchManifest(pluginManager, plugin.resource, reach);
  if (!manifest) {
    return null;
  }

  const jsUrl = findAsset(manifest, 'script', plugin.resource);
  if (!jsUrl) {
    serverLog.warn('SSR', `Plugin "${plugin.type}" has no JS asset in manifest, skipping`);
    return null;
  }

  // Served from where the plugin was published rather than downloaded and imported here. A space's external
  // plugins are third-party bundles on immutable, versioned URLs: fetching one only to import it into the render
  // process buys server-rendered markup at the price of running that bundle's own React inside the renderer,
  // which is an invalid hook call and a 500 for the whole page instead of a blank component.
  const source: PluginSourceFile = {
    js: jsUrl,
    css: findAsset(manifest, 'style', plugin.resource),
    action: 'cdn',
    version: manifest.version
  };

  return pluginManager.ensure(plugin.type, source);
};

/**
 * Reads plugins listed in offlineData.plugins, fetches their manifests, downloads and caches
 * JS/CSS via the PluginManager, and returns the effective plugin keys to pass to getEntries().
 *
 * `registered`: the types this deployment registers itself — a project's own build of a plugin the space also lists
 * on its CDN. Those are never looked for elsewhere: the deployment's copy is the one rendered, and asking the CDN for a
 * manifest nobody will use is a request, and a warning, for nothing.
 */
export const registerExternalPlugins = async (
  pluginManager: PluginManager,
  offlineData: OfflineDataRaw | undefined,
  reach: ManifestReach = { allowPrivateHosts: false },
  registered: ReadonlySet<string> = new Set()
): Promise<string[]> => {
  const plugins = offlineData?.plugins?.filter(plugin => !registered.has(plugin.type));
  if (!plugins || plugins.length === 0) {
    return [];
  }

  const results = await Promise.all(plugins.map(p => registerPlugin(pluginManager, p, reach)));
  return results.filter((k): k is string => k !== null);
};
