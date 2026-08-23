import fs from 'node:fs/promises';
import path from 'node:path';

import esbuild from 'esbuild';

const EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  '@plitzi/plitzi-sdk',
  '@plitzi/sdk-shared'
];

/**
 * Assets a stylesheet drags in with it, inlined.
 *
 * A plugin that imports a library's CSS — a map, a date picker, an editor — imports its images too, and without a
 * loader for them the build fails on a file the author never wrote. Inlined as data URIs rather than emitted
 * beside the bundle, because the plugin is served as exactly two files and a third that nothing routes to would
 * be a stylesheet with broken references in it.
 */
const ASSET_LOADERS: Record<string, esbuild.Loader> = {
  '.png': 'dataurl',
  '.jpg': 'dataurl',
  '.jpeg': 'dataurl',
  '.gif': 'dataurl',
  '.svg': 'dataurl',
  '.webp': 'dataurl',
  '.woff': 'dataurl',
  '.woff2': 'dataurl'
};

export const compilePlugin = async (
  jsPath: string,
  outDir: string,
  devMode: boolean = false
): Promise<{ hasCSS: boolean }> => {
  await esbuild.build({
    entryPoints: [jsPath],
    bundle: true,
    format: 'esm',
    external: EXTERNAL,
    loader: ASSET_LOADERS,
    outdir: outDir,
    entryNames: 'index',
    jsx: 'automatic',
    minify: !devMode,
    splitting: false,
    logLevel: 'warning'
  });

  const hasCSS = await fs
    .access(path.join(outDir, 'index.css'))
    .then(() => true)
    .catch(() => false);

  return { hasCSS };
};
