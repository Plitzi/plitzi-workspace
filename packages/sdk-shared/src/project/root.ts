import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { BUILD_DIR, SOURCE_DIR } from './paths';

/**
 * What the root of a project `@plitzi/cli` writes holds, whatever else it has: its `package.json`, and its source — what
 * the server builds the plugins and functions from at boot, in production too.
 */
const ROOT_MARKERS = ['package.json', `${SOURCE_DIR}/`];

/** A process started outside the project's root: its message names what is missing, and where to run it instead. */
export class ProjectRootError extends Error {
  constructor(root: string, missing: readonly string[]) {
    super(
      `${root} is not the root of a Plitzi project: it has no ${missing.join(' and no ')}. Run it from the project's root, the folder its package.json is in — where its scripts run it (npm start, npm run author).`
    );
    this.name = 'ProjectRootError';
  }
}

// A bundler renames a class it inlines, and a process that ends on the error prints the constructor's name beside its own.
Object.defineProperty(ProjectRootError, 'name', { value: 'ProjectRootError' });

/**
 * `root`, when it is the root of a project `@plitzi/cli` writes; refused otherwise, naming what it lacks. What
 * `projectRoot` holds the working directory to — and what a tool working on a project from another folder (the CLI, run
 * anywhere inside one) holds the root it found to.
 */
export const checkProjectRoot = (root: string): string => {
  const missing = ROOT_MARKERS.filter(marker => !existsSync(path.join(root, marker)));
  if (missing.length > 0) {
    throw new ProjectRootError(root, missing);
  }

  return root;
};

/**
 * The root of the project this process runs: its working directory. Every script of the project's `package.json` runs
 * there, and a deployment starts `node dist/main.js` there too — so the root is never worked out from where a file is,
 * and a process started from anywhere else is refused, saying what is missing (`checkProjectRoot`).
 */
export const projectRoot = (): string => checkProjectRoot(process.cwd());

/** `file` with every link on its way resolved — `/tmp` is `/private/tmp` on macOS — or as it is, when it is not there. */
const real = (file: string): string => {
  try {
    return realpathSync(file);
  } catch {
    return path.resolve(file);
  }
};

/**
 * Where a module of the project's source (`entry`, under `src/` — `src/space/index.ts`) is, in the form the process
 * runs in: what `build` emitted (`dist/space/index.js`) when it was started on that — `node dist/main.js`, which carries
 * no TypeScript at all — and the source otherwise. Told by the script the process was started with (`script`,
 * `process.argv[1]`), followed through any link, rather than by `NODE_ENV`: a production server run from its source
 * still finds the source, and one run compiled never imports a `.ts` file.
 */
export const projectModule = (root: string, entry: string, script: string | undefined): string => {
  const build = real(path.join(root, BUILD_DIR));
  const compiled = script !== undefined && real(script).startsWith(`${build}${path.sep}`);

  return path.join(
    root,
    compiled ? path.join(BUILD_DIR, path.relative(SOURCE_DIR, entry)).replace(/\.tsx?$/, '.js') : entry
  );
};
