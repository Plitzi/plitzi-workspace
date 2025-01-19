/// <reference types="vite/client" />
/// <reference types="vitest" />

// Packages
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: false,
      exclude: [
        '**/*.test.tsx',
        '**/*.stories.ts',
        '**/*.stories.tsx',
        'vite.config.mts'
        // 'setupTests.ts',
        // 'node_modules'
      ],
      tsconfigPath: './tsconfig.app.json'
    })
  ],
  resolve: {
    alias: {
      //     '@icons': resolve(__dirname, './src/icons'),
      //     '@components': path.resolve(__dirname, './src/components'),
      //     '@hooks': path.resolve(__dirname, './src/hooks'),
      //     '@': resolve(__dirname, './src')
    }
  },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  build: {
    lib: {
      entry: ['./src/index.ts'],
      // name: 'plitzi-ui',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [...Object.keys(pkg.dependencies), 'lodash/get.js', 'react/jsx-runtime'],
      output: {
        exports: 'named',
        preserveModules: true, // Keep module structure for tree-shaking
        // preserveModulesRoot: 'src', // Tell Rollup where to "root" the modules (under src)
        entryFileNames: '[name].[format]',
        chunkFileNames: '[name].[format]',
        assetFileNames: '[name].[ext]', // assetFileNames: 'assets/[name][extname]',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'react/jsx-runtime' // tailwindcss: "tailwindcss",
        }
      }
    },
    sourcemap: false,
    emptyOutDir: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      reportsDirectory: 'tests',
      include: ['src'],
      exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx'] // , 'src/index.ts'
    },
    reporters: ['default']
  }
});
