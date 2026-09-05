/// <reference types="vite/client" />
/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

/**
 * A command, not a library.
 *
 * So there are no type declarations to emit and no consumer to keep an export surface stable for: what ships is one
 * executable file with a shebang, and `bin` in the manifest points at it. `commander` and `chalk` stay external —
 * they are the package's own dependencies, and bundling them would ship two copies to anyone who has them already.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node20',
    lib: { entry: './src/index.ts', formats: ['es'] },
    rollupOptions: {
      external: ['chalk', 'commander', /^node:/],
      output: { entryFileNames: 'index.js', banner: '#!/usr/bin/env node' }
    },
    minify: false,
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
