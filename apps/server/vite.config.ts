/// <reference types="vite/client" />

import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const baseUrl = new URL('.', import.meta.url);

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.app.json',
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: {
        index: path.resolve(baseUrl.pathname, 'src/index.ts'),
        server: path.resolve(baseUrl.pathname, 'src/server.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: (id) => {
        // Externalize all node built-ins
        if (id.startsWith('node:') || id.startsWith('node/')) return true;
        // Externalize react and react-dom
        if (id === 'react' || id === 'react-dom' || id.startsWith('react-dom/') || id.startsWith('react/')) return true;
        // Externalize all workspace packages and npm packages (not relative paths)
        if (!id.startsWith('.') && !id.startsWith('/')) return true;
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
});
