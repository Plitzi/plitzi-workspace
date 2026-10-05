import fs from 'node:fs/promises';
import path from 'node:path';

import { inPluginLayer } from '@plitzi/sdk-shared/style/cssLayers';

import { copyFileAtomic, writeFileAtomic } from '../helpers/atomicFile';

export const copyPlugin = async (src: string, destDir: string, filename: string): Promise<void> => {
  const dest = path.join(destDir, filename);

  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`[SSR] Plugin fetch failed ${src}: ${res.status}`);
    }

    await writeFileAtomic(dest, await res.text());
  } else {
    await copyFileAtomic(src, dest);
  }
};

/**
 * A plugin's stylesheet, copied or downloaded into the cache in the plugins' cascade layer — below the space's styles,
 * as a compiled one is — whatever the file it came from says.
 */
export const copyPluginStylesheet = async (src: string, destDir: string): Promise<void> => {
  let css: string;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`[SSR] Plugin stylesheet fetch failed ${src}: ${res.status}`);
    }

    css = await res.text();
  } else {
    css = await fs.readFile(src, 'utf8');
  }

  await writeFileAtomic(path.join(destDir, 'index.css'), inPluginLayer(css));
};
