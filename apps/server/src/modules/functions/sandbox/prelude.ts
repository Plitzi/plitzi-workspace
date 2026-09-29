import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

/**
 * The web APIs a bare V8 lacks that are the spec's to get right rather than ours: `URL`, `URLSearchParams`, `atob`,
 * `btoa`, `structuredClone`, `DOMException` — core-js's, bundled once per runner process. What is left (`Headers`,
 * `Request`, `Response`, timers, `crypto`, `ctx`) is the guest's, because each of those is a call to the runner.
 */
const POLYFILLS = [
  'core-js/actual/dom-exception',
  'core-js/actual/url',
  'core-js/actual/url-search-params',
  'core-js/actual/structured-clone',
  'core-js/actual/atob',
  'core-js/actual/btoa'
];

const build = async (): Promise<string> => {
  const require = createRequire(import.meta.url);
  let entries: string[];
  try {
    entries = POLYFILLS.map(entry => require.resolve(entry));
  } catch {
    throw new Error('Running space functions in isolates needs core-js@3 installed beside @plitzi/sdk-server');
  }

  const result = await esbuild.build({
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

let prelude: Promise<string> | undefined;

/** The prelude's source, built on first use and the same for every isolate this process makes. */
export const guestPrelude = (): Promise<string> => {
  prelude ??= build();

  return prelude;
};
