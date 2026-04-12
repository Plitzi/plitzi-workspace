/// <reference types="vite/client" />
/// <reference types="vitest" />

import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const importedPackages = new Set();

type Options = {
  root?: string;
  pattern?: RegExp;
};

export function getEntries(options: Options = {}) {
  const root = options.root ?? path.resolve(process.cwd(), 'src');
  const pattern = options.pattern ?? /index\.(ts|js|mjs)$/;

  const entries: Record<string, string> = {};

  function walk(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(file)) {
        // nombre del entry basado en carpeta
        const name = path.relative(root, fullPath).replace(pattern, '').replace(/\/$/, '') || 'index';

        entries[name] = fullPath;
      }
    }
  }

  walk(root);

  return entries;
}

export default defineConfig(({ mode, command }) => {
  return {
    plugins: [
      react(),
      dts({
        // entryRoot: '.',
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx', 'vite.config.ts', 'setupTests.ts'],
        tsconfigPath: './tsconfig.app.json'
      }),
      // {
      //   name: 'trace-import-chain',
      //   enforce: 'pre',
      //   resolveId(source, importer) {
      //     if (source.includes('plitzi')) {
      //       console.log('\n---');
      //       console.log('IMPORT:', source);
      //       console.log('FROM  :', importer);
      //     }
      //     return null;
      //   }
      // },
      {
        name: 'externalize-and-log',
        enforce: 'pre',
        resolveId(source, importer) {
          if (!importer || command === 'serve' || process.env.VITEST) {
            // Ignore main entries or runtime or tests
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
        //     '@': resolve(__dirname, './src'),
      },
      extensions: ['.js', '.ts', '.tsx', '.mjs']
    },
    build: {
      outDir: 'dist/src',
      lib: {
        entry: Object.values(getEntries()) // ['./src/index.ts'] // , './src/network/index.ts', './src/network/graphql/index.ts'
      },
      rollupOptions: {
        treeshake: false,
        output: [
          {
            format: 'es',
            exports: 'named',
            preserveModules: true, // Keep module structure for tree-shaking
            preserveModulesRoot: 'src', // Tell Rollup where to "root" the modules (under src)
            entryFileNames: '[name].mjs',
            chunkFileNames: '[name].mjs',
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
      setupFiles: ['../sdk-shared/setupTests.ts'],
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
