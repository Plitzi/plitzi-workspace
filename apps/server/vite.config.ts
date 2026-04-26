/// <reference types="vite/client" />

import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const baseUrl = new URL('.', import.meta.url);
const root = baseUrl.pathname;

const copyAssets = (): import('vite').Plugin => ({
  name: 'copy-assets',
  closeBundle() {
    const copies: [string, string][] = [
      [path.resolve(root, 'src/ssr/views'), path.resolve(root, 'dist/ssr/views')],
      [path.resolve(root, 'src/modules/ssr/views'), path.resolve(root, 'dist/modules/ssr/views')],
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
        include: ['src'],
        tsconfigPath: './tsconfig.app.json',
        insertTypesEntry: true
      }),
      copyAssets()
    ],
    define: {
      'process.env.NODE_ENV': devMode ? '"development"' : '"production"'
    },
    build: {
      lib: {
        entry: {
          index: path.resolve(root, 'src/index.ts'),
          server: path.resolve(root, 'src/standalone/server.ts')
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
