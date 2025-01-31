/// <reference types="vite/client" />
/// <reference types="vitest" />

// Packages
import { nodeResolve } from '@rollup/plugin-node-resolve';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

// Relatives
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode, ...args }) => {
  return {
    plugins: [
      nodeResolve({ extensions: ['ts', 'tsx'] }),
      react(),
      dts({
        entryRoot: 'src',
        outDir: 'dist',
        rollupTypes: false,
        exclude: [
          '**/*.test.tsx',
          '**/*.stories.ts',
          '**/*.stories.tsx'
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
        external: [
          ...Object.keys(pkg.dependencies),
          'lodash/get',
          'lodash/set',
          'lodash/has',
          'lodash/pick',
          'lodash/omit',
          'lodash/isEmpty',
          'lodash/pick',
          'react-router',
          'react-router-dom',
          'react/jsx-runtime',
          'immer'
        ],
        output: {
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
      reporters: ['default']
    }
  };
});
