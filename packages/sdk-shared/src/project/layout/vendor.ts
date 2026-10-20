import { readFileSync } from 'node:fs';
import path from 'node:path';

import { finding } from './codes';
import { exists } from './files';
import { isRecord } from '../../helpers/isRecord';
import { PLUGIN_MANIFEST_FILE, VENDOR_PLUGINS_DIR } from '../paths';

import type { LayoutFinding } from './codes';

/** What a built plugin runs, by absolute path: its script, its style and its server half, as its manifest names them. */
export interface VendorPlugin {
  script: string;
  style?: string;
  version: string;
  functions?: string;
}

type ManifestAsset = { src: string; type: string; isMain: boolean };

const assetsOf = (manifest: Record<string, unknown>): ManifestAsset[] =>
  isRecord(manifest.assets)
    ? Object.values(manifest.assets).flatMap(asset =>
        isRecord(asset) && typeof asset.src === 'string' && typeof asset.type === 'string'
          ? [{ src: asset.src, type: asset.type, isMain: asset.isMain === true }]
          : []
      )
    : [];

/**
 * A plugin of `vendor/plugins/` — one a project made from a space runs as it was built, beside the manifest `plitzi
 * pack plugin` wrote when it was published — or what keeps it from running.
 */
export const readVendorPlugin = (root: string, type: string): VendorPlugin | { problem: LayoutFinding } => {
  const at = `${VENDOR_PLUGINS_DIR}/${type}`;
  const file = `${at}/${PLUGIN_MANIFEST_FILE}`;
  const again = `npx plitzi space pull brings it again — or delete ${at}/, and the space renders no ${type}.`;
  if (!exists(root, file, 'file')) {
    return {
      problem: finding(
        'vendor-manifest-missing',
        `${at}/`,
        `${at}/ has no ${PLUGIN_MANIFEST_FILE}: the server runs a built plugin by what its manifest names, so ${type} does not run.`,
        again
      )
    };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(path.join(root, file), 'utf-8'));
  } catch (error) {
    return {
      problem: finding(
        'vendor-manifest-invalid',
        file,
        `${file} is not JSON (${error instanceof Error ? error.message : String(error)}), so ${type} does not run.`,
        again
      )
    };
  }

  if (!isRecord(manifest)) {
    return {
      problem: finding('vendor-manifest-invalid', file, `${file} is not a manifest, so ${type} does not run.`, again)
    };
  }

  const assets = assetsOf(manifest);
  const script =
    assets.find(asset => asset.type === 'script' && asset.isMain) ?? assets.find(asset => asset.type === 'script');
  if (!script) {
    return {
      problem: finding('vendor-script-missing', file, `${file} names no script to run, so ${type} does not run.`, again)
    };
  }

  if (!exists(root, path.posix.join(at, script.src), 'file')) {
    return {
      problem: finding(
        'vendor-script-missing',
        file,
        `${file} names ${script.src} as the script to run, and ${at}/${script.src} is not there, so ${type} does not run.`,
        again
      )
    };
  }

  const style = assets.find(asset => asset.type === 'style');

  return {
    script: path.join(root, at, script.src),
    ...(style ? { style: path.join(root, at, style.src) } : {}),
    version: typeof manifest.version === 'string' ? manifest.version : '1.0.0',
    ...(typeof manifest.functions === 'string' ? { functions: path.join(root, at, manifest.functions) } : {})
  };
};
