/// <reference types="vite/client" />
/// <reference types="vitest" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';
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

/**
 * The path an external import is written with in the build (`output.paths`). As written — except a deep import of a
 * package with no `exports` map that does not name its file (`react-syntax-highlighter/dist/esm/languages/prism/bash`),
 * written as the file it resolves to (`….js`): a bundler finds the file either way, Node only by its name, and a server
 * that runs this package's build with Node itself — a project of the CLI, a self-hosted server — failed on it.
 */
const externalPath = (source: string): string => {
  const deep = deepSpecifier(source);
  if (!deep || path.extname(deep.subpath) !== '') {
    return source;
  }

  let file: string;
  try {
    file = createRequire(path.join(process.cwd(), 'package.json')).resolve(source);
  } catch {
    // Not resolvable from here (a peer the consumer brings): kept as written, as every other import is.
    return source;
  }

  const root = packageRootOf(file, deep.name);
  if (!root) {
    return source;
  }

  const { exports } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { exports?: unknown };

  return exports === undefined ? `${deep.name}/${path.relative(root, file).split(path.sep).join('/')}` : source;
};

const importedPackages = new Set();

/** `@scope/name/sub/path` or `name/sub/path` → the package's name and the path inside it; nothing for a bare name. */
const deepSpecifier = (source: string): { name: string; subpath: string } | undefined => {
  const parts = source.split('/');
  const nameParts = source.startsWith('@') ? 2 : 1;
  if (parts.length <= nameParts) {
    return undefined;
  }

  return { name: parts.slice(0, nameParts).join('/'), subpath: parts.slice(nameParts).join('/') };
};

/** The `package.json` of the package a resolved file belongs to: the nearest one above it that names the package. */
const packageRootOf = (file: string, name: string): string | undefined => {
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const { name: found } = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as { name?: string };
      if (found === name) {
        return dir;
      }
    }
  }

  return undefined;
};

/**
 * Under test, a workspace package is read from its sources (`@plitzi/source` in its `exports`), not from `dist`: a test
 * then runs against the code of the packages it depends on as it is now, with no build first and no stale one to
 * mislead it. Builds never resolve it, so what is bundled and published is unchanged.
 */
const SOURCE_CONDITION = '@plitzi/source';
const testConditions = (defaults: readonly string[]) =>
  process.env.VITEST ? [SOURCE_CONDITION, ...defaults] : undefined;

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
 * use, while a folder barrel is public all the same (`"./*"`) and `vite-plugin-dts` writes the FULL declaration
 * beside it. The result type-checks against exports the runtime file does not have, and the consumer finds out on
 * import: "does not provide an export named ...".
 */
const SOURCE_MODULE = /\.(ts|tsx|js|mjs)$/;
/** Matched against the path under `src`, so a whole test-only folder is excluded, not just suffixed file names. */
const NOT_A_MODULE = new RegExp(
  ['(^|/)(tests|__mocks__)(/|$)', '\\.(test|spec|stories[^.]*|bench)\\.(ts|tsx|js|mjs)$', '\\.d\\.ts$'].join('|')
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
        exclude: [
          '**/*.(test|bench).(ts|tsx)',
          '**/tests/**',
          '**/*.stories.(ts|tsx)',
          'vite.config.ts',
          'setupTests.ts'
        ],
        tsconfigPath: './tsconfig.app.json',
        // The declarations are written against the other packages' declarations, as a consumer reads them: through
        // their sources they would be compiled under this package's settings and their paths written into its types.
        compilerOptions: { customConditions: [] },
        beforeWriteFile: skipUnchangedDts
      }),
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
      conditions: testConditions(defaultClientConditions),
      alias: {
        //     '@icons': resolve(__dirname, './src/icons'),
        //     '@components': path.resolve(__dirname, './src/components'),
        //     '@hooks': path.resolve(__dirname, './src/hooks'),
        //     '@': resolve(__dirname, './src'),
      },
      extensions: ['.js', '.ts', '.tsx', '.mjs'],
      // `@plitzi/nexus` and `@plitzi/plitzi-ui` may be linked through portals, each carrying its own node_modules. React and
      // CodeMirror check identity (a hook's dispatcher, an extension's `instanceof`), so a second copy breaks them: one each.
      dedupe: [
        'react',
        'react-dom',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr'
      ]
    },
    ssr: {
      resolve: { conditions: testConditions(defaultServerConditions) }
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
            paths: externalPath,
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
        exclude: ['**/*.test.tsx', '**/tests/**', '**/*.stories.ts', '**/*.stories.tsx'] // , 'src/index.ts'
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
