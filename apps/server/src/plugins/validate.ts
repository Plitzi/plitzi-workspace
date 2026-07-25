import fs from 'node:fs';

import { isComponentSource } from './detect';

import type { PluginSource } from '@plitzi/sdk-shared';

const isRemote = (js: string): boolean => js.startsWith('http://') || js.startsWith('https://');

/** The file a plugin source needs on disk, or null when nothing local is involved — a remote URL (fetched and
 *  cached at request time) or a component handed in directly. */
export const localSourcePath = (source: PluginSource): string | null => {
  if (isComponentSource(source) || isRemote(source.js)) {
    return null;
  }

  return source.js;
};

/** Fail at boot on a plugin whose entry file is missing. A plugin entry is a plain string path in the server
 *  config, so nothing — not tsc, not eslint — notices when that file is moved or deleted; without this check the
 *  server starts happily and only dies on the first render that needs the plugin, with an esbuild resolve error
 *  far from its cause. */
export const assertPluginSources = (plugins: Record<string, PluginSource>): void => {
  const missing = Object.entries(plugins)
    .map(([name, source]) => ({ name, file: localSourcePath(source) }))
    .filter(entry => entry.file !== null && !fs.existsSync(entry.file))
    .map(entry => `  ${entry.name}: ${entry.file ?? ''}`);

  if (missing.length > 0) {
    throw new Error(`Plugin entry file not found (declared in the server config):\n${missing.join('\n')}`);
  }
};
