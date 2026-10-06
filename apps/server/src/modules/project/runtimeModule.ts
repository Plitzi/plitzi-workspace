import { realpathSync } from 'node:fs';
import path from 'node:path';

import { BUILD_DIR, RUNTIME_ENTRY, SOURCE_DIR } from '@plitzi/sdk-shared/project/paths';

/** The runtime as `build` emits it: the same file under `dist/`, as JavaScript. */
const COMPILED_RUNTIME = path.join(BUILD_DIR, path.relative(SOURCE_DIR, RUNTIME_ENTRY)).replace(/\.ts$/, '.js');

/** `file` with every link on its way resolved — `/tmp` is `/private/tmp` on macOS — or as it is, when it is not there. */
const real = (file: string): string => {
  try {
    return realpathSync(file);
  } catch {
    return path.resolve(file);
  }
};

/**
 * Where the project's server finds the space's runtime, in the form the server itself runs in: compiled
 * (`dist/runtime/index.js`) when the process was started on what `build` emitted — `node dist/main.js`, which carries no
 * TypeScript at all — and its source (`src/runtime/index.ts`) otherwise. Told by the script the process was started
 * with (`process.argv[1]`), followed through any link, rather than by `NODE_ENV`: a production server run from its
 * source still finds the source, and one run compiled never imports a `.ts` file.
 */
export const runtimeModule = (root: string, script: string | undefined): string => {
  const build = real(path.join(root, BUILD_DIR));
  const compiled = script !== undefined && real(script).startsWith(`${build}${path.sep}`);

  return path.join(root, compiled ? COMPILED_RUNTIME : RUNTIME_ENTRY);
};
