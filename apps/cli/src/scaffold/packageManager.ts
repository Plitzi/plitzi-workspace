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
 * Yarn 4 installs Plug'n'Play by default, and a server-mode project cannot start that way: `node --import tsx`
 * dies on its first import with "Some options passed to require() aren't supported by PnP yet (conditions)" —
 * tsx's resolver calls into Node's with conditions PnP does not implement. `node-modules` is the layout npm and
 * pnpm already give it, so pinning it is what makes all three managers produce a project that runs, rather than
 * two that do and one that fails the moment somebody types `yarn start`.
 */
export const managerFiles = (manager: PackageManager): ProjectFiles =>
  manager === 'yarn' ? { '.yarnrc.yml': 'nodeLinker: node-modules\n' } : {};
