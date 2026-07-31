/// <reference types="vite/client" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { shipsAsSource, VIEW_DIR } from './src/modules/mcp/apps/shared/assets';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const baseUrl = new URL('.', import.meta.url);
const root = baseUrl.pathname;

// Which files of an MCP App ship as source — the rule lives with the apps (and is pinned by their test suite), so
// the build and the invariant cannot drift apart. Directories always pass: cpSync needs them to recurse.
const isAppAsset = (src: string): boolean => fs.statSync(src).isDirectory() || shipsAsSource(src);

const copyAssets = (): import('vite').Plugin => ({
  name: 'copy-assets',
  closeBundle() {
    const copies: [string, string, ((src: string) => boolean)?][] = [
      [path.resolve(root, 'src/ssr/views'), path.resolve(root, 'dist/ssr/views')],
      [path.resolve(root, 'src/modules/ssr/views'), path.resolve(root, 'dist/modules/ssr/views')],
      // An MCP App's view and page shell ship as SOURCE: the server bundles the view with esbuild at runtime and
      // inlines it, so neither is ever part of the module graph this build compiles.
      [path.resolve(root, 'src/modules/mcp/apps'), path.resolve(root, 'dist/modules/mcp/apps'), isAppAsset],
      [path.resolve(root, 'public'), path.resolve(root, 'dist/public')]
    ];
    for (const [src, dest, filter] of copies) {
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true, filter });
      }
    }
  }
});

export default defineConfig(({ mode }) => {
  const devMode = mode !== 'production';

  return {
    plugins: [
      react(),
      dts({
        include: ['src', 'package.json'],
        // An MCP App's view/ ships as source and nothing imports it: declarations for it would be dead weight.
        exclude: [`src/modules/mcp/apps/**/${VIEW_DIR}/**`],
        tsconfigPath: './tsconfig.app.json',
        insertTypesEntry: true
      }),
      copyAssets()
    ],
    define: {
      'process.env.NODE_ENV': devMode ? '"development"' : '"production"',
      VERSION: JSON.stringify(PACKAGE.version)
    },
    build: {
      lib: {
        entry: {
          index: path.resolve(root, 'src/index.ts'),
          // The MCP role's slim entry: importing the barrel would load every other service with it.
          mcp: path.resolve(root, 'src/mcp.ts')
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
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['../../packages/sdk-shared/setupTests.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: 'tests',
        include: ['src'],
        exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx'] // , 'src/index.ts'
      },
      server: {
        deps: {
          inline: ['@plitzi/plitzi-ui']
        }
      },
      reporters: ['default']
    }
  };
});
