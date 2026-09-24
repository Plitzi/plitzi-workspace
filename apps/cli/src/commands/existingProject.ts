import fs from 'node:fs/promises';
import path from 'node:path';

import type { PackageManager } from '../scaffold';

/**
 * The project something is being added to, when there is one: where it starts, how it is installed, and where it keeps
 * what it is made of.
 *
 * Read, never assumed. A plugin written into somebody's repository has to land where that repository looks for one and
 * install with the manager it already uses — a second lockfile is how a scaffold makes itself unwelcome.
 */
export interface ExistingProject {
  /** The directory of the nearest `package.json`. */
  root: string;
  /** The manager its lockfile names, looked for here and in the workspace around it. */
  packageManager?: PackageManager;
  /** The workspace this project belongs to, when it belongs to one: the root that declares the workspaces. */
  workspaceRoot?: string;
  /** Folders a new package of the workspace goes in — `packages/*` declares `packages`. Relative to `workspaceRoot`. */
  workspaceFolders: string[];
  /** What `plitzi create` wrote, if it did: a project that registers every folder of `src/plugins` on its own. */
  plitzi?: { mode: 'server' | 'client' };
}

interface PackageJson {
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const LOCKFILES: [string, PackageManager][] = [
  ['yarn.lock', 'yarn'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm']
];

const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.access(file);

    return true;
  } catch {
    return false;
  }
};

const readPackageJson = async (dir: string): Promise<PackageJson | undefined> => {
  try {
    // A package.json is somebody's file: it is read for the three fields below and nothing is trusted beyond them.
    return JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8')) as PackageJson;
  } catch {
    return undefined;
  }
};

/** The workspace globs a root declares — npm's and Yarn's `workspaces`, or pnpm's own file. */
const workspaceGlobs = async (dir: string, packageJson: PackageJson): Promise<string[]> => {
  const { workspaces } = packageJson;
  if (Array.isArray(workspaces)) {
    return workspaces;
  }

  if (workspaces?.packages) {
    return workspaces.packages;
  }

  try {
    const pnpm = await fs.readFile(path.join(dir, 'pnpm-workspace.yaml'), 'utf-8');
    // Only the `packages:` list, one `- 'glob'` per line: the shape pnpm documents, and all this needs of the file.
    const block = /^packages:\s*\n((?:\s+-\s*.+\n?)+)/m.exec(pnpm)?.[1] ?? '';

    return [...block.matchAll(/-\s*['"]?([^'"\n]+)['"]?/g)].map(match => match[1].trim());
  } catch {
    return [];
  }
};

/** From every directory upward, the first that holds a `package.json`. */
const nearestPackage = async (from: string): Promise<string | undefined> => {
  let dir = from;
  for (;;) {
    if (await exists(path.join(dir, 'package.json'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
};

/** The first directory at or above `from` that declares workspaces, with what it declares. */
const nearestWorkspace = async (from: string): Promise<{ root: string; globs: string[] } | undefined> => {
  for (let dir = await nearestPackage(from); dir; dir = await nearestPackage(path.dirname(dir))) {
    const packageJson = await readPackageJson(dir);
    const globs = packageJson ? await workspaceGlobs(dir, packageJson) : [];
    if (globs.length > 0) {
      return { root: dir, globs };
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }

  return undefined;
};

const lockfileManager = async (dirs: string[]): Promise<PackageManager | undefined> => {
  for (const dir of dirs) {
    for (const [file, manager] of LOCKFILES) {
      if (await exists(path.join(dir, file))) {
        return manager;
      }
    }
  }

  return undefined;
};

/**
 * A project `plitzi create` wrote, told by what it depends on and by its entry point finding plugins by folder —
 * which is what makes a folder under `src/plugins` enough to register one. A project from before that, or one somebody
 * rewrote, is an ordinary project here: it is told how to register the plugin rather than assumed to.
 */
const plitziProject = async (root: string, packageJson: PackageJson): Promise<ExistingProject['plitzi']> => {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!('@plitzi/plitzi-sdk' in dependencies)) {
    return undefined;
  }

  let main = '';
  try {
    main = await fs.readFile(path.join(root, 'src/main.ts'), 'utf-8');
  } catch {
    return undefined;
  }

  if ('@plitzi/sdk-server' in dependencies && main.includes('readdirSync(PLUGINS_DIR')) {
    return { mode: 'server' };
  }

  if (main.includes('import.meta.glob<{ default: RenderPlugins[string]')) {
    return { mode: 'client' };
  }

  return undefined;
};

/** The project `from` is inside, or `undefined` when no directory above it has a `package.json`. */
export const findProject = async (from: string): Promise<ExistingProject | undefined> => {
  const root = await nearestPackage(from);
  if (!root) {
    return undefined;
  }

  const packageJson = (await readPackageJson(root)) ?? {};
  const workspace = await nearestWorkspace(root);
  const workspaceFolders = (workspace?.globs ?? [])
    .filter(glob => glob.endsWith('/*') && !glob.startsWith('!'))
    .map(glob => glob.slice(0, -2));

  return {
    root,
    packageManager: await lockfileManager(workspace ? [root, workspace.root] : [root]),
    workspaceRoot: workspace?.root,
    workspaceFolders,
    plitzi: await plitziProject(root, packageJson)
  };
};

/** Whether `dir` is one of the workspace's packages — a folder its globs cover — so an install there installs it. */
export const coveredByWorkspace = (project: ExistingProject, dir: string): boolean =>
  project.workspaceRoot !== undefined &&
  project.workspaceFolders.some(folder => path.dirname(dir) === path.join(project.workspaceRoot ?? '', folder));
