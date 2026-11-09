import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The web APIs a bare V8 lacks that are the spec's to get right rather than ours: `URL`, `URLSearchParams`, `atob`,
 * `btoa`, `structuredClone`, `DOMException` — core-js's, bundled into one script every isolate starts with. What is left
 * (`Headers`, `Request`, `Response`, timers, `crypto`, `ctx`) is the guest's, because each of those is a call to the
 * runner.
 */
const POLYFILLS = [
  'core-js/actual/dom-exception',
  'core-js/actual/url',
  'core-js/actual/url-search-params',
  'core-js/actual/structured-clone',
  'core-js/actual/atob',
  'core-js/actual/btoa'
];

/** Where the package's build keeps the prelude it made (`scripts/prelude.mjs`), from the package's root. */
export const BUILT_PRELUDE = 'dist/prelude.js';

/**
 * The prelude, built from core-js with esbuild: what the package's build writes to {@link BUILT_PRELUDE}, and what a
 * process running this package's sources (its tests, the workspace's servers) makes for itself. Neither core-js nor
 * esbuild is a runner's to install.
 */
export const buildPrelude = async (): Promise<string> => {
  const require = createRequire(import.meta.url);
  let entries: string[];
  try {
    entries = POLYFILLS.map(entry => require.resolve(entry));
  } catch {
    throw new Error('Building the functions prelude needs core-js@3 installed beside @plitzi/sdk-runtime');
  }

  // Loaded here alone: a runner reading the built prelude never starts esbuild.
  const { esbuildBuild } = await import('@plitzi/sdk-kernel/build');
  const result = await esbuildBuild({
    stdin: {
      contents: entries.map(entry => `import ${JSON.stringify(entry)};`).join('\n'),
      loader: 'js',
      // Without one esbuild resolves nothing from stdin, absolute paths included.
      resolveDir: path.dirname(fileURLToPath(import.meta.url))
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    logLevel: 'silent'
  });

  return result.outputFiles[0]?.text ?? '';
};

/** This package's root: the nearest `package.json` above this module that names it — under `src` or under `dist`. */
const packageRoot = (): string => {
  for (let dir = path.dirname(fileURLToPath(import.meta.url)); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    try {
      const { name } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { name?: unknown };
      if (name === '@plitzi/sdk-runtime') {
        return dir;
      }
    } catch {
      // No manifest here: further up.
    }
  }

  throw new Error('@plitzi/sdk-runtime cannot find its own package.json, where its built prelude is kept');
};

/**
 * The prelude as this process has it: from its sources, built now — so a change to the polyfills is never hidden by an
 * old build; from the package's build, the file it shipped with, which it refuses to run without.
 */
const loadPrelude = (): Promise<string> => {
  if (import.meta.url.endsWith('.ts')) {
    return buildPrelude();
  }

  const file = path.join(packageRoot(), BUILT_PRELUDE);
  try {
    return Promise.resolve(readFileSync(file, 'utf-8'));
  } catch {
    return Promise.reject(
      new Error(`@plitzi/sdk-runtime is missing ${BUILT_PRELUDE}, which its build writes: reinstall it, or build it`)
    );
  }
};

let prelude: Promise<string> | undefined;

/** The prelude's source, read or built on first use and the same for every isolate this process makes. */
export const guestPrelude = (): Promise<string> => {
  prelude ??= loadPrelude();

  return prelude;
};
