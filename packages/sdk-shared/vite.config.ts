/// <reference types="vite/client" />
/// <reference types="vitest" />

import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Skips rewriting a declaration whose content is already on disk. Every build regenerates every `.d.ts`, unchanged
 * ones included, and replacing hundreds of files at once is what makes the editors holding them open fall over.
 * Inlined rather than shared: a vite config that imports across the project boundary is not in its own `tsconfig`'s
 * file list, which is a build error (TS6307) — and the apps, which cannot import this one at all, do the same.
 */
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

const importedPackages = new Set();

type Options = {
  root?: string;
  pattern?: RegExp;
  exclude?: RegExp;
};

/**
 * Every source module is an entry, not just the `index` ones.
 *
 * `preserveModules` writes one file per module either way, so this changes no path — what it changes is the export
 * list. A module rollup considers internal is re-exported only for the bindings its in-package importers happen to
 * use, while `generate-exports.mjs` publishes it as a public subpath all the same and `vite-plugin-dts` writes the
 * FULL declaration beside it. The result type-checks against exports the runtime file does not have, and the
 * consumer finds out on import: "does not provide an export named ...".
 */
const SOURCE_MODULE = /\.(ts|tsx|js|mjs)$/;
/** Matched against the path under `src`, so a whole test-only folder is excluded, not just suffixed file names. */
const NOT_A_MODULE = new RegExp(
  [
    '(^|/)(__tests__|__mocks__|testUtils)(/|$)',
    '\\.(test|spec|stories[^.]*|bench)\\.(ts|tsx|js|mjs)$',
    '\\.d\\.ts$'
  ].join('|')
);

export function getEntries(options: Options = {}) {
  const root = options.root ?? path.resolve(process.cwd(), 'src');
  const pattern = options.pattern ?? SOURCE_MODULE;
  const exclude = options.exclude ?? NOT_A_MODULE;

  const entries: Record<string, string> = {};

  function walk(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const relative = path.relative(root, fullPath).replace(/\\/g, '/');
        if (pattern.test(file) && !exclude.test(relative)) {
          entries[relative.replace(pattern, '') || 'index'] = fullPath;
        }
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
        entryRoot: 'src',
        exclude: ['**/*.test.(ts|tsx)', '**/*.stories.(ts|tsx)', 'vite.config.ts', 'setupTests.ts'],
        tsconfigPath: './tsconfig.app.json',
        beforeWriteFile: skipUnchangedDts
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
      extensions: ['.js', '.ts', '.tsx', '.mjs'],
      // `@plitzi/nexus` lives in its own repo and is linked through a portal, so it carries its own
      // node_modules/react. Without deduping, its hooks run against a second React copy and every
      // useContext reads a null dispatcher.
      dedupe: ['react', 'react-dom']
    },
    build: {
      // outDir: 'dist/src',
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
        ],
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
        }
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
