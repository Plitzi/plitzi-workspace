/// <reference types="vite/client" />
/// <reference types="vitest" />

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * A package that installs nothing.
 *
 * Authoring is data and functions over data — no React, nothing that touches a browser — and the people who need
 * it most are the ones with no reason to install an SDK at all: a seed, a migration, a build script, someone
 * writing a template. So the five fragments it composes are bundled in at build time and declared as devDependencies,
 * and what ships is one file with an empty dependency tree.
 *
 * `bundleTypes` is the half that makes that true of the TYPES as well: emitted per-file, the declaration re-exports
 * by specifier (`export * from '@plitzi/sdk-elements/authoring'`) and a consumer needs all five packages installed
 * to typecheck against a package that depends on none of them.
 *
 * No aliases onto the packages' sources, deliberately: they would be resolved into the emitted declaration as
 * relative paths into this repository, which is a package that only typechecks on the machine that built it. The
 * fragments are resolved the way anyone else resolves them — through their own package entries.
 */
export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      include: ['src'],
      exclude: ['**/*.test.ts'],
      // `bundleTypes` is api-extractor, and `bundledPackages` is what makes it follow an `export *` into another
      // package instead of leaving the specifier in place. Without it the entry rolls up to five re-exports and the
      // empty dependency tree is a lie the moment anyone typechecks against it. `plitzi-ui` is named on its own
      // because the glob alone does not reach it — its types arrive through a subpath (`/QueryBuilder`).
      bundleTypes: { bundledPackages: ['@plitzi/*', '@plitzi/plitzi-ui'] },
      tsconfigPath: './tsconfig.app.json'
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: './src/index.ts', formats: ['es'] },
    rollupOptions: {
      output: { entryFileNames: 'index.js', chunkFileNames: 'index-[name].js' }
    },
    minify: false,
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default']
  }
});
