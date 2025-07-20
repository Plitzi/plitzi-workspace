/// <reference types="vite/client" />
/// <reference types="vitest" />

import path from 'path';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import pkg from './package.json' with { type: 'json' };

const importedPackages = new Set();

export default defineConfig(({ mode, command }) => {
  return {
    plugins: [
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      react(),
      dts({
        entryRoot: 'src',
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx', 'vite.config.ts', 'setupTests.ts'],
        tsconfigPath: './tsconfig.json'
      }),
      {
        name: 'debug-resolve',
        resolveId(/* source, importer */) {
          // console.log(`[VITE RESOLVE] Trying to resolve: ${source} from ${importer}`);
          return null; // Allow vite keep resolving
        }
      },
      {
        name: 'externalize-and-log',
        enforce: 'pre',
        resolveId(source, importer) {
          if (!importer || command === 'serve') {
            // Ignore main entries or runtime
            return null;
          }

          // Mark as external modules or sub-modules from node_modules
          if (!source.startsWith('.') && !path.isAbsolute(source)) {
            importedPackages.add(source);

            return { id: source, external: true };
          }

          return null;
        },
        buildEnd() {
          if (mode === 'development' && importedPackages.size > 0) {
            console.log('Packages imported:', Array.from(importedPackages));
          }
        }
      }
    ],
    resolve: {
      alias: {
        //     '@icons': resolve(__dirname, './src/icons'),
        //     '@components': path.resolve(__dirname, './src/components'),
        //     '@hooks': path.resolve(__dirname, './src/hooks'),
        //     '@': resolve(__dirname, './src')
      },
      extensions: ['.js', '.ts', '.tsx']
    },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
    build: {
      lib: {
        entry: ['./src/index.ts']
        // name: 'plitzi-ui',
      },
      rollupOptions: {
        treeshake: false,
        external: [
          ...Object.keys(pkg.dependencies),
          'lodash/get',
          'lodash/set',
          'lodash/has',
          'lodash/pick',
          'lodash/capitalize',
          'lodash/camelCase',
          'lodash/omit',
          'lodash/throttle',
          'lodash/isEmpty',
          'lodash/pick',
          'react-router',
          'react-router-dom',
          'react/jsx-runtime',
          'immer',
          'moment'
        ],
        output: [
          {
            format: 'es',
            exports: 'named',
            preserveModules: true, // Keep module structure for tree-shaking
            preserveModulesRoot: 'src', // Tell Rollup where to "root" the modules (under src)
            entryFileNames: '[name].[format]',
            chunkFileNames: '[name].[format]',
            assetFileNames: '[name].[ext]', // assetFileNames: 'assets/[name][extname]',
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'react/jsx-runtime' // tailwindcss: "tailwindcss",
            }
          }
          // {
          //   format: 'cjs',
          //   exports: 'named',
          //   preserveModules: true, // Keep module structure for tree-shaking
          //   preserveModulesRoot: 'src', // Tell Rollup where to "root" the modules (under src)
          //   entryFileNames: '[name].[format]',
          //   chunkFileNames: '[name].[format]',
          //   assetFileNames: '[name].[ext]', // assetFileNames: 'assets/[name][extname]',
          //   globals: {
          //     react: 'React',
          //     'react-dom': 'ReactDOM',
          //     'react/jsx-runtime': 'react/jsx-runtime' // tailwindcss: "tailwindcss",
          //   }
          // }
        ]
      },
      sourcemap: false,
      emptyOutDir: mode === 'production'
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['@plitzi/sdk-shared/setupTests.ts'],
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
