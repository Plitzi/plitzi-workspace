import { spawnSync } from 'node:child_process';

import type { PackageManager, ProjectFiles } from './types';

/**
 * The package manager the generated project is written for.
 *
 * It decides nothing about what the project IS — the same files either way — but every command the scaffold
 * quotes has to be one the reader can paste, and the reader has exactly one of these installed. Printing
 * `npm install` to somebody who runs Yarn is how a scaffold produces a second lockfile.
 */

export const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm'] as const satisfies readonly PackageManager[];

/**
 * The one that invoked this, when nobody said.
 *
 * `npm_config_user_agent` is set by all three, so `npx`, `yarn dlx` and `pnpm dlx` each get their own commands
 * back. It is only ever a guess about the *invocation*, though — plenty of people reach for `npx` to run a
 * one-off and then work in the project with Yarn, which is what `--package-manager` is for.
 */
export const detectPackageManager = (): PackageManager => {
  const agent = process.env.npm_config_user_agent ?? '';

  return PACKAGE_MANAGERS.find(manager => agent.startsWith(manager)) ?? 'npm';
};

export const installCommand = (manager: PackageManager): string => `${manager} install`;

/** `npm` needs `run` in front of a script that is not a lifecycle one; the other two take the name alone. */
export const runCommand = (manager: PackageManager, script: string): string =>
  manager === 'npm' && script !== 'start' ? `npm run ${script}` : `${manager} ${script}`;

/**
 * Yarn's own file, and the only per-manager file the scaffold writes.
 *
 * Yarn 4 installs Plug'n'Play by default, and this project is run straight from `node_modules`: its server by Node
 * itself, its plugins by the page server's bundler. `node-modules` is the layout npm and pnpm already give it, so
 * pinning it is what makes all three managers produce a project that runs, rather than two that do and one that
 * fails the moment somebody types `yarn start`.
 */
const YARN_LINKER = 'nodeLinker: node-modules\n';

const YARN_AGE_GATE = `
# Plitzi's packages are released together with the CLI that wrote this project, so on release day every one of them
# is younger than Yarn's minimal age gate and the install stops on YN0016. The exemption covers that scope only.
npmPreapprovedPackages:
  - "@plitzi/*"
`;

/**
 * Whether this Yarn has the age gate, and so knows the setting that exempts from it.
 *
 * Asked because the answer is not free to get wrong in either direction: without the setting a current Yarn
 * quarantines every package released that day, and with it a Yarn older than 4.10 refuses the whole file
 * ("Unrecognized or legacy configuration settings") before it installs anything. Yarn 1 does not read
 * `.yarnrc.yml` at all. A version nobody could read is taken to be current.
 */
export const yarnHasAgeGate = (version?: string): boolean => {
  const [major, minor] = (version ?? '').split('.').map(Number);
  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    return true;
  }

  return major === 1 || major > 4 || (major === 4 && minor >= 10);
};

/**
 * The version of a manager as it will run in `cwd`, or `undefined` when it is not there to ask.
 *
 * Asked from where the project will live, not from wherever the CLI was started: a repository above it can pin its
 * own Yarn (`yarnPath`, `packageManager`), and that one — not the one on the PATH — is what installs the project.
 */
export const detectManagerVersion = (manager: PackageManager, cwd: string): string | undefined => {
  const result = spawnSync(manager, ['--version'], { cwd, encoding: 'utf-8', shell: process.platform === 'win32' });

  return result.status === 0 ? result.stdout.trim() || undefined : undefined;
};

/**
 * pnpm's settings file, which is also what it reads outside a workspace.
 *
 * pnpm runs no install script it was not told to, and it stops the install over one it skipped: esbuild's checks
 * the native binary the page server compiles plugins with. The release-age exemption is Yarn's, for the same reason.
 */
const PNPM_WORKSPACE = `allowBuilds:
  esbuild: true

minimumReleaseAgeExclude:
  - '@plitzi/*'
`;

export const managerFiles = (manager: PackageManager, version?: string): ProjectFiles => {
  if (manager === 'yarn') {
    return { '.yarnrc.yml': yarnHasAgeGate(version) ? `${YARN_LINKER}${YARN_AGE_GATE}` : YARN_LINKER };
  }

  if (manager === 'pnpm') {
    return { 'pnpm-workspace.yaml': PNPM_WORKSPACE };
  }

  return {};
};

/**
 * What npm reads from `package.json` itself: which dependencies may run install scripts.
 *
 * npm 11 lists every unreviewed one on each install and says a later release will block them. esbuild's script
 * checks its native binary; fsevents is flagged only for the `binding.gyp` it ships beside a prebuilt binary, so
 * refusing it changes nothing and says so. Other managers ignore the field.
 */
export const managerPackageFields = (manager: PackageManager): Record<string, unknown> =>
  manager === 'npm' ? { allowScripts: { esbuild: true, fsevents: false } } : {};
