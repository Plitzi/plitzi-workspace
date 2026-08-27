/// <reference types="vite/client" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const baseUrl = new URL('.', import.meta.url);
const root = baseUrl.pathname;

const copyAssets = (): import('vite').Plugin => ({
  name: 'copy-assets',
  closeBundle() {
    const copies: [string, string, ((src: string) => boolean)?][] = [
      [path.resolve(root, 'src/ssr/views'), path.resolve(root, 'dist/ssr/views')],
      [path.resolve(root, 'src/modules/ssr/views'), path.resolve(root, 'dist/modules/ssr/views')]
    ];
    for (const [src, dest, filter] of copies) {
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true, filter });
      }
    }
  }
});

/** Skips rewriting a declaration whose content is already on disk. Every build regenerates every `.d.ts`, unchanged
 *  ones included, and replacing hundreds of files at once is what makes the editors holding them open fall over.
 *  Inlined rather than shared: a vite config importing across packages breaks `composite` type-checking (TS6059). */
const skipUnchangedDts = (filePath: string, content: string) => {
  try {
    if (fs.readFileSync(filePath, 'utf8') === content) {
      return false as const;
    }
  } catch {
    // Not there yet — first build, or a new module. Write it.
  }

  return undefined;
};

export default defineConfig(({ mode }) => {
  const devMode = mode !== 'production';

  return {
    plugins: [
      react(),
      dts({
        include: ['src', 'package.json'],
        entryRoot: 'src',
        tsconfigPath: './tsconfig.app.json',
        insertTypesEntry: true,
        beforeWriteFile: skipUnchangedDts
      }),
      copyAssets()
    ],
    define: {
      'process.env.NODE_ENV': devMode ? '"development"' : '"production"',
      VERSION: JSON.stringify(PACKAGE.version)
    },
    build: {
      // Keep the previous output in place during development so `beforeWriteFile` has something to compare against:
      // wiping dist means every declaration is written afresh, and the editors holding them open re-parse the lot.
      emptyOutDir: !devMode,
      lib: {
        entry: {
          index: path.resolve(root, 'src/index.ts'),
          // Narrow entries for packages that build on this one. The barrel re-exports the whole render path and
          // ESM re-exports load eagerly, so a sibling server importing from it would load React with them.
          kernel: path.resolve(root, 'src/kernel.ts'),
          auth: path.resolve(root, 'src/auth.ts'),
          // The account store, implemented. Its own entry because it is the only thing in the package that reaches
          // for a database driver: a deployment bringing its own store never loads `mysql2` to find that out.
          mysql: path.resolve(root, 'src/mysql.ts'),
          ssr: path.resolve(root, 'src/ssr.ts'),
          // Server actions. Own entry so a deployment writing its own tasks imports the contract alone, and a
          // server that runs none never loads the runner or the task set to find that out.
          actions: path.resolve(root, 'src/actions.ts'),
          // Ready-made request handlers for the auth flows. Depends on no framework — see src/handlers.ts —
          // but keeping it out of the barrels is what makes it opt-in rather than something a page server drags in.
          handlers: path.resolve(root, 'src/handlers.ts'),
          // Authoring spaces offline. Own entry, and free of everything else here: writing a page is what a seed
          // or a migration does, and neither has a request to serve.
          authoring: path.resolve(root, 'src/authoring.ts')
        },
        formats: ['es']
      },
      rollupOptions: {
        external: id => {
          if (id.startsWith('node:') || id.startsWith('node/')) {
            return true;
          }

          if (id === 'react' || id === 'react-dom' || id.startsWith('react-dom/') || id.startsWith('react/')) {
            return true;
          }

          if (!id.startsWith('.') && !id.startsWith('/')) {
            return true;
          }

          return false;
        },
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          format: 'es',
          entryFileNames: '[name].js'
        }
      },
      target: 'node20',
      ssr: true,
      minify: false
    }
  };
});
