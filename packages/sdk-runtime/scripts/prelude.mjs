import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILT_PRELUDE, buildPrelude } from '../src/runner/prelude.ts';

/**
 * The prelude every isolate starts with, built once here and shipped in `dist`: a runner then reads it, and installs
 * neither core-js nor esbuild to make it.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, BUILT_PRELUDE);
const prelude = await buildPrelude();
if (!prelude) {
  throw new Error('The functions prelude built empty');
}

mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, prelude);
console.log(`Built the functions prelude into ${BUILT_PRELUDE} (${String(Math.round(prelude.length / 1024))} KB)`);
