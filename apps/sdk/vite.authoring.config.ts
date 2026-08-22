/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * The authoring entry, built on its own.
 *
 * Separate from the SDK bundle because the two have nothing in common: the SDK is a React application compiled for
 * a browser, and this is data and functions over data, imported by Node — a seed, a migration, a self-hosted
 * server. Building it here rather than beside `index.tsx` is also what guarantees the separation holds: if this
 * entry ever pulled in a component, the build would start emitting React and it would be obvious.
 */
export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      include: ['src/authoring.ts'],
      rollupTypes: false,
      tsconfigPath: './tsconfig.app.json'
    })
  ],
  // No aliases onto the packages' sources, deliberately: they would be resolved into the emitted declaration as
  // relative paths into this repository, which is a package that only typechecks on the machine that built it.
  // The fragments are resolved the way anyone else resolves them — through their own package entries.
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: './src/authoring.ts', formats: ['es'] },
    rollupOptions: {
      output: { entryFileNames: 'plitzi-sdk-authoring.js', chunkFileNames: 'plitzi-sdk-authoring-[name].js' }
    },
    minify: false,
    sourcemap: false
  }
});
