import { createRequire } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

/**
 * The Functions panel's TypeScript worker, built apart: `dist/plitzi-functions-worker.js`, one self-contained module
 * beside `plitzi-builder.js`. Apart because the builder is a single file and a compiler inside it would be paid for by
 * everybody who opens the builder, where this is fetched only by whoever opens the panel.
 */
export const typescriptLibAlias = {
  '@typescript-lib': path.join(path.dirname(require.resolve('typescript/package.json')), 'lib')
};

export default defineConfig(({ mode }) => ({
  resolve: { alias: typescriptLibAlias },
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development') },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/modules/Functions/editor/typescriptWorker.ts'),
      formats: ['es'],
      fileName: () => 'plitzi-functions-worker.js'
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
    minify: mode === 'production' ? 'terser' : false,
    sourcemap: false
  }
}));
