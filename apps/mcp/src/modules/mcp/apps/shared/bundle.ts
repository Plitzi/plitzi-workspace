import { build } from 'esbuild';

import { require } from './resolve';
import { zodEnglishOnly } from './zodEnglishOnly';

import type { BuildOptions } from 'esbuild';

// `satisfies` rather than an annotation: it keeps `write: false` a literal, which is what tells esbuild's typings
// the result carries outputFiles.
const options = (entry: string) =>
  ({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    minify: true,
    // Collapses the SDK's own `from '@plitzi/plitzi-sdk'` self-imports onto the bundled copy; without it they
    // survive as bare imports the iframe cannot resolve.
    alias: { '@plitzi/plitzi-sdk': require.resolve('@plitzi/plitzi-sdk') },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [zodEnglishOnly],
    logLevel: 'silent'
  }) satisfies BuildOptions;

export const bundle = async (entry: string): Promise<string> => {
  const result = await build(options(entry));

  return result.outputFiles[0].text;
};

/** Every file the view pulls in, resolved by the build that serves it. The suite asks for this to check each one
 *  ships as source: a view-side module the package leaves behind resolves here, in the repo, and nowhere else. */
export const bundleInputs = async (entry: string): Promise<string[]> => {
  const result = await build({ ...options(entry), metafile: true });

  return Object.keys(result.metafile.inputs);
};
