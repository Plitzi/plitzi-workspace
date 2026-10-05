import fs from 'node:fs/promises';
import path from 'node:path';

import esbuild from 'esbuild';

import { pluginAssetLoaders, pluginImportQueries } from '@plitzi/sdk-shared/plugins/bundle';
import { inPluginLayer } from '@plitzi/sdk-shared/style/cssLayers';

import { writeFileAtomic } from '../helpers/atomicFile';

const EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  '@plitzi/plitzi-sdk',
  '@plitzi/sdk-shared'
];

/**
 * Everything that went into the bundle, so a server can tell when any of it has moved on: a dev server as it is
 * edited, and any server — a deployment — when it finds a bundle built from something else (its content digest).
 *
 * The entry file is one file and a plugin is a directory: a component edited beside its `index.ts` leaves the entry's
 * timestamp exactly where it was, and a watcher looking only at that never rebuilds. esbuild already knows the answer
 * — this is its own list of inputs — so nothing has to be guessed from the file system.
 *
 * Dependencies are left out. They change when something is installed, which is not an edit anybody is waiting to see,
 * and stat'ing a few thousand files on every cache miss to find that out is a real cost for no answer.
 */
const sourceInputs = (metafile: esbuild.Metafile | undefined): string[] =>
  metafile
    ? Object.keys(metafile.inputs)
        .filter(input => !input.includes('node_modules'))
        // A file imported whole (`?raw`, `?inline`) is listed under its loader's namespace: the file is what changes.
        .map(input => path.resolve(input.replace(/^plitzi-(raw|inline):/, '')))
    : [];

export const compilePlugin = async (
  jsPath: string,
  outDir: string,
  devMode: boolean = false
): Promise<{ hasCSS: boolean; inputs: string[] }> => {
  const result = await esbuild.build({
    entryPoints: [jsPath],
    bundle: true,
    format: 'esm',
    external: EXTERNAL,
    // Inside the bundle, as `plitzi pack` carries them: the plugin is served as its module and its stylesheet, and a
    // third file nothing carries would be a broken reference — images and fonts, a `?raw` worker, an `?inline` module.
    loader: pluginAssetLoaders(),
    plugins: [pluginImportQueries()],
    outdir: outDir,
    entryNames: 'index',
    jsx: 'automatic',
    minify: !devMode,
    splitting: false,
    logLevel: 'warning',
    // What went in: what a dev server watches, and what the cached bundle's content digest is taken over.
    metafile: true,
    // Kept in memory and written file by file whole — another worker may be building or reading the same plugin.
    write: false
  });

  await fs.mkdir(outDir, { recursive: true });
  await Promise.all(
    result.outputFiles.map(output =>
      // The plugin's stylesheet in its layer, below the space's: written so, every way it reaches a page agrees.
      writeFileAtomic(output.path, output.path.endsWith('.css') ? inPluginLayer(output.text) : output.contents)
    )
  );
  const hasCSS = result.outputFiles.some(output => path.basename(output.path) === 'index.css');

  return { hasCSS, inputs: sourceInputs(result.metafile) };
};
