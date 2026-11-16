import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { contentTypeOf } from './contentType';
import { resolveSdkAssetsDir } from '../core/sdkAssets';

import type { BuildVersions, SiteFile } from './types';

/**
 * The SDK's files a site served off this server loads — the bundle, React and its kin (the vendor bundle), the
 * stylesheets, the icon fonts and the chunks the bundle imports — read from the installed `@plitzi/plitzi-sdk`, so a
 * site carries its own copy instead of asking a third-party CDN for React at run time. Kept under a folder named by
 * their digest: immutable, and a deploy with a newer SDK is a new folder, never a file changed in place.
 */

/** What a browser never asks for: the development builds, source maps, the pre-compressed copies, the package's own. */
const LEFT_OUT = /(\.gz|\.map|\.d\.ts)$|^(index\.html|robots\.txt|build\.json)$|dev-vendor/;

export interface SdkFiles {
  /** The folder they live under, relative to the site's root: `_plitzi/sdk-<digest>`. */
  folder: string;
  digest: string;
  files: SiteFile[];
}

let read: SdkFiles | undefined;

const walk = (dir: string, prefix = ''): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Only the folders the bundle loads from: the icon fonts.
      return entry.name === 'webfonts' ? walk(path.join(dir, entry.name), relative) : [];
    }

    return LEFT_OUT.test(entry.name) ? [] : [relative];
  });

/** The SDK's files, read once a process — the installed SDK cannot change while it runs. */
export const sdkFiles = (): SdkFiles => {
  if (read) {
    return read;
  }

  const dir = resolveSdkAssetsDir();
  if (!dir) {
    throw new Error(
      '@plitzi/plitzi-sdk is not installed beside @plitzi/sdk-server: a site served off it has no SDK to load'
    );
  }

  const names = walk(dir).sort();
  const bodies = names.map(name => readFileSync(path.join(dir, name)));
  const hash = createHash('sha256');
  names.forEach((name, index) => hash.update(name).update(bodies[index]));
  const digest = hash.digest('hex').slice(0, 12);
  const folder = `_plitzi/sdk-${digest}`;

  read = {
    folder,
    digest,
    files: names.map((name, index) => ({
      path: `${folder}/${name}`,
      body: new Uint8Array(bodies[index]),
      type: contentTypeOf(name),
      cache: 'immutable'
    }))
  };

  return read;
};

const versionOf = (manifest: string): string => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));

    return parsed !== null && typeof parsed === 'object' && 'version' in parsed && typeof parsed.version === 'string'
      ? parsed.version
      : 'unknown';
  } catch {
    return 'unknown';
  }
};

let versions: BuildVersions | undefined;

/** The versions a build made here bakes in (§5.2): the SDK beside this server, its React, and this server. */
export const buildVersions = (): BuildVersions => {
  if (versions) {
    return versions;
  }

  const dir = resolveSdkAssetsDir();
  const require = createRequire(import.meta.url);
  let react = 'unknown';
  try {
    react = versionOf(require.resolve('react/package.json'));
  } catch {
    // React is the page server's peer: a build without it says so in its versions rather than guessing one.
  }

  versions = { sdk: dir ? versionOf(path.join(dir, '..', 'package.json')) : 'unknown', react, sdkServer: VERSION };

  return versions;
};
