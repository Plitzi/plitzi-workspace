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

export const compilePlugin = async (jsPath: string, outDir: string): Promise<{ hasCSS: boolean }> => {
  await esbuild.build({
    entryPoints: [jsPath],
    bundle: true,
    format: 'esm',
    external: EXTERNAL,
    outdir: outDir,
    entryNames: 'index',
    jsx: 'automatic',
    minify: true,
    splitting: false,
    logLevel: 'silent'
  });

  const hasCSS = await fs
    .access(path.join(outDir, 'index.css'))
    .then(() => true)
    .catch(() => false);

  return { hasCSS };
};
