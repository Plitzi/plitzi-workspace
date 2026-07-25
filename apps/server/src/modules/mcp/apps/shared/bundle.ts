import { build } from 'esbuild';

import { require } from './resolve';
import { zodEnglishOnly } from './zodEnglishOnly';

export const bundle = async (entry: string): Promise<string> => {
  const result = await build({
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
  });

  return result.outputFiles[0].text;
};
