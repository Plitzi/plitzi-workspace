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
    const copies: [string, string][] = [
      [path.resolve(root, 'src/ssr/views'), path.resolve(root, 'dist/ssr/views')],
      [path.resolve(root, 'src/modules/ssr/views'), path.resolve(root, 'dist/modules/ssr/views')],
      // The MCP Apps view is shipped as SOURCE: the server bundles it with esbuild at runtime and inlines the
      // result in the ui:// resource, so it is never part of the module graph this build bundles.
      [path.resolve(root, 'src/modules/mcp/views'), path.resolve(root, 'dist/modules/mcp/views')],
      [path.resolve(root, 'public'), path.resolve(root, 'dist/public')]
    ];
    for (const [src, dest] of copies) {
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
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
        // The MCP Apps view ships as source and nothing imports it: a declaration for it would be dead weight.
        exclude: ['src/modules/mcp/views'],
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
