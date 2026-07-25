import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { SdkAssetUrls } from '../modules/mcp/types';
import type { SSRServerConfig } from '@plitzi/sdk-shared';

// URL prefix the Plitzi SDK bundle is served under. Both consumers of the SDK's browser build — the SSR page
// template and the MCP Apps render view — import it from here.
export const SDK_ASSETS_PREFIX = '/sdk-assets';

// @plitzi/plitzi-sdk is a direct dependency of this package, so its dist ships alongside the server and resolves
// itself, with no path to configure. (createRequire because this is ESM.)
const require = createRequire(import.meta.url);

let distDir: string | null | undefined;

/** The installed @plitzi/plitzi-sdk dist directory, or null when the package is not resolvable. */
export const sdkDistDir = (): string | null => {
  if (distDir === undefined) {
    try {
      distDir = path.dirname(require.resolve('@plitzi/plitzi-sdk'));
    } catch {
      distDir = null;
    }
  }

  return distDir;
};

// Static assets are served `immutable` for a year (see getCacheControl), so their URLs need a cache buster or an
// SDK upgrade would never reach a browser that already cached them. The consumer's `assetVersion` wins; without
// one, fall back to the dist mtime so the URLs still change when the package is updated.
let distVersion: string | undefined;

const sdkDistVersion = (): string => {
  if (distVersion === undefined) {
    const dir = sdkDistDir();
    try {
      distVersion = dir ? Math.floor(statSync(path.join(dir, 'plitzi-sdk.js')).mtimeMs).toString(36) : '';
    } catch {
      distVersion = '';
    }
  }

  return distVersion;
};

// Anything that reaches a URL must be inert there: the version ends up in an HTML attribute and in an import map.
const sanitizeVersion = (version: string): string => version.replace(/[^A-Za-z0-9._-]/gu, '');

/** Build the SDK asset URLs for a document that imports the SDK — `baseUrl` is where {@link SDK_ASSETS_PREFIX} is
 *  reachable from that document (absolute when it lives on another origin, as the MCP Apps view does). */
export const sdkAssetUrls = ({
  baseUrl = SDK_ASSETS_PREFIX,
  devMode = false,
  version
}: {
  baseUrl?: string;
  devMode?: boolean;
  version?: string;
}): SdkAssetUrls => {
  const base = baseUrl.replace(/\/+$/u, '');
  const resolved = sanitizeVersion(version ?? sdkDistVersion());
  const v = resolved ? `?v=${resolved}` : '';

  return {
    js: `${base}/plitzi-sdk.js${v}`,
    css: `${base}/plitzi-sdk.css${v}`,
    vendor: `${base}/${devMode ? 'plitzi-sdk-dev-vendor.js' : 'plitzi-sdk-vendor.js'}${v}`
  };
};

/** Mount the installed SDK dist under {@link SDK_ASSETS_PREFIX} unless the consumer already mounted that prefix
 *  (dev servers point it at a local build). The MCP Apps render view imports the SDK from there, so a dedicated
 *  MCP server serves it with no configuration. */
export const withSdkAssets = (config: SSRServerConfig): SSRServerConfig => {
  if (config.static?.[SDK_ASSETS_PREFIX]) {
    return config;
  }

  const dir = sdkDistDir();
  if (!dir) {
    return config;
  }

  return { ...config, static: { ...config.static, [SDK_ASSETS_PREFIX]: dir } };
};
