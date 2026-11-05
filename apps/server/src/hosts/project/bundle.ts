import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';

import { esbuildBuild } from '@plitzi/sdk-kernel/build';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { BUILD_DIR, FUNCTIONS_DIR, MAIN_FILE, PLUGINS_DIR, projectRoot, SOURCE_DIR } from '@plitzi/sdk-shared/project';

import type { Plugin } from 'esbuild';

/**
 * What a project's server shares with the code it loads as it runs, left to `node_modules`: the plugins it compiles at
 * boot import React and the SDK from there, and a second copy inside the bundle would be a second React — other
 * contexts than the ones a page is drawn with. Everything else goes in, `@plitzi/*` included: the space's module and the
 * runtime's are entries of the same bundle (`bundleProject`), so they share its copy.
 */
const SHARED_WITH_LOADED_CODE = ['react', 'react/*', 'react-dom', 'react-dom/*', 'scheduler', '@plitzi/plitzi-sdk'];

/**
 * What runs a binary or loads one by a path of its own (esbuild drives its own executable), and what a driver asks for
 * only when it is configured to (`require` inside a `try`). A native package not named here is found by its manifest
 * (`nativePackages`).
 */
const LEFT_OUT = [
  'esbuild',
  '@esbuild/*',
  'isolated-vm',
  'sharp',
  '@img/*',
  'fsevents',
  'lightningcss',
  'lightningcss-*',
  'bufferutil',
  'utf-8-validate'
];

/** What says a package carries a compiled binary: it is built, or downloaded, when it is installed. */
const NATIVE_LOADERS = ['node-gyp-build', 'bindings', 'prebuild-install', '@mapbox/node-pre-gyp', 'node-addon-api'];

const packageNameOf = (specifier: string): string => {
  const [scope, name] = specifier.split('/');

  return specifier.startsWith('@') ? `${scope}/${name}` : scope;
};

const manifestOf = (name: string, from: string): Record<string, unknown> | undefined => {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', name, 'package.json');
    if (existsSync(file)) {
      const manifest: unknown = JSON.parse(readFileSync(file, 'utf-8'));

      return isRecord(manifest) ? manifest : undefined;
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
};

const isNative = (manifest: Record<string, unknown>): boolean => {
  const dependencies = isRecord(manifest.dependencies) ? Object.keys(manifest.dependencies) : [];

  return (
    manifest.gypfile === true || isRecord(manifest.binary) || dependencies.some(name => NATIVE_LOADERS.includes(name))
  );
};

/**
 * A native package a project depends on, left to `node_modules` without anybody listing it: its binary is loaded by a
 * path beside its own files, which a bundle would move away from them.
 */
const nativePackages = (): Plugin => ({
  name: 'plitzi-native-packages',
  setup(build) {
    const known = new Map<string, boolean>();
    build.onResolve({ filter: /^[^./]/ }, args => {
      if (args.path.startsWith('node:')) {
        return undefined;
      }

      const name = packageNameOf(args.path);
      if (!known.has(name)) {
        const manifest = manifestOf(name, args.resolveDir || process.cwd());
        known.set(name, manifest !== undefined && isNative(manifest));
      }

      return known.get(name) ? { path: args.path, external: true } : undefined;
    });
  }
});

/** A module of the project's source, as the bundle names it: `src/space/index.ts` is `space/index` (`dist/space/index.js`). */
const entryName = (file: string): string => path.relative(SOURCE_DIR, file).replace(/\.[mc]?[jt]sx?$/, '');

const SOURCE_MODULE = /\.(ts|tsx|mts|js|mjs)$/;
const NOT_A_MODULE = /\.(test|spec)\.[mc]?[jt]sx?$|\.d\.ts$/;

/**
 * Every module of the project's source but what the server builds itself at boot (`src/plugins`, `src/functions`): each
 * one a file of its own in the build, where its source is, as `tsc` wrote them.
 */
const projectModules = (root: string): string[] =>
  readdirSync(path.join(root, SOURCE_DIR), { recursive: true, encoding: 'utf-8' })
    .map(file => path.join(SOURCE_DIR, file))
    .filter(file => SOURCE_MODULE.test(file) && !NOT_A_MODULE.test(file))
    .filter(file => ![PLUGINS_DIR, FUNCTIONS_DIR].some(dir => file.startsWith(`${dir}${path.sep}`)));

const RELATIVE_MODULE = /^\.\.?\//;

/**
 * An import of one module of the project by another stays an import of its file, rather than being folded into whoever
 * imports it: the project's code finds what is beside it by where it is (`actionsIn(new URL('./', import.meta.url))`,
 * `pagesIn`, a page's `publicData`), and a module bundled into another — or moved to a shared chunk — is somewhere else.
 * What the build writes no file for (a plugin's declaration the space imports) goes in with whoever imports it.
 */
const projectFilesStay = (modules: ReadonlySet<string>): Plugin => ({
  name: 'plitzi-project-files-stay',
  setup(build) {
    build.onResolve({ filter: RELATIVE_MODULE }, args => {
      if (args.kind === 'entry-point' || !modules.has(args.importer)) {
        return undefined;
      }

      const target = path.resolve(path.dirname(args.importer), args.path);

      return modules.has(target) ? { path: args.path.replace(/\.(ts|tsx|mts)$/, '.js'), external: true } : undefined;
    });
  }
});

export type BundleProjectOptions = {
  /** The project's root; the process's own by default, as its scripts run it. */
  root?: string;
  /** More packages to leave to `node_modules`: one that loads its own files by a path of its own. */
  external?: string[];
};

/** What the build wrote: the project's modules, one file each, and the chunks the packages they import are in. */
export type BundledProject = { modules: number; chunks: number; ms: number };

/**
 * A project's server as production runs it (`npm run build`, then `start:prod`): every module of its source a file of its
 * own in `dist/`, where `tsc` wrote it — `src/main.ts` is `dist/main.js`, the space's and the runtime's where the server
 * imports them by their path (`projectModule`) — and every package they import bundled once, in `dist/chunks/`, shared
 * by all of them. Node resolves, loads and links every module a process imports, and a project's server as `tsc` left it
 * imported each package's files one by one before it answered.
 *
 * The plugins and the functions are not in it: the server builds them from their source when it starts, as always.
 */
export const bundleProject = async ({
  root = projectRoot(),
  external = []
}: BundleProjectOptions = {}): Promise<BundledProject> => {
  const started = Date.now();
  // Its real path: esbuild names an importer by it, and a temporary folder is a link on some systems (`/var` on macOS).
  const realRoot = realpathSync(root);
  const entries = projectModules(realRoot);
  if (!entries.includes(MAIN_FILE)) {
    throw new Error(`${MAIN_FILE} is not there: it is what the project's server starts from`);
  }

  const out = path.join(realRoot, BUILD_DIR);
  rmSync(out, { recursive: true, force: true });

  const result = await esbuildBuild({
    absWorkingDir: realRoot,
    entryPoints: Object.fromEntries(entries.map(file => [entryName(file), path.join(realRoot, file)])),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outdir: out,
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    sourcemap: 'linked',
    // A dependency written as CommonJS asks for `require`, `__filename` and `__dirname` inside an ES module.
    banner: {
      js: [
        "import { createRequire as __plitziRequire } from 'node:module';",
        "import { fileURLToPath as __plitziFileURLToPath } from 'node:url';",
        'const require = __plitziRequire(import.meta.url);',
        'const __filename = __plitziFileURLToPath(import.meta.url);',
        "const __dirname = __plitziFileURLToPath(new URL('.', import.meta.url));"
      ].join('\n')
    },
    external: [...SHARED_WITH_LOADED_CODE, ...LEFT_OUT, ...external],
    plugins: [projectFilesStay(new Set(entries.map(file => path.join(realRoot, file)))), nativePackages()],
    logLevel: 'warning',
    metafile: true
  });

  const outputs = Object.keys(result.metafile.outputs).filter(file => file.endsWith('.js'));

  return {
    modules: entries.length,
    chunks: outputs.length - entries.length,
    ms: Date.now() - started
  };
};
