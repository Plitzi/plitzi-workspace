import fs from 'node:fs/promises';
import path from 'node:path';

import { declarationsRegistry, elementsRegistry } from '../scaffold';

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
  /** What `plitzi create` wrote, if it did — a project that renders a space, or a plugin package. */
  plitzi?: PlitziProject | PluginPackage;
}

/** A project `plitzi create` wrote. */
export interface PlitziProject {
  kind: 'project';
  mode: 'server' | 'client';
  /** Whether the space is `src/space.ts` (`local`) or lives in Plitzi and is edited in the builder (`cloud`). */
  source: 'local' | 'cloud';
  /**
   * Whether its entry point registers every folder of `src/plugins` by itself. A project from before that lists its
   * plugins in `src/main.ts`, and a new one has to be added to that list.
   */
  discovers: boolean;
}

/** A package `plitzi create --plugin` wrote. */
export interface PluginPackage {
  kind: 'plugin';
  /**
   * Its elements, in the order its lists give them — or `undefined` when `src/elements.ts` and `src/declarations.ts`
   * are no longer the lists the CLI wrote, and so are not the CLI's to rewrite.
   */
  components?: string[];
}

interface PackageJson {
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

/**
 * A plugin package's elements, read off its `src/elements.ts` — and trusted only when writing them back out gives both
 * of its lists byte for byte, which is what says nobody has changed them since the CLI did.
 */
const packageComponents = async (root: string): Promise<string[] | undefined> => {
  const [elements, declarations] = await Promise.all([
    readText(path.join(root, 'src/elements.ts')),
    readText(path.join(root, 'src/declarations.ts'))
  ]);
  if (elements === undefined || declarations === undefined) {
    return undefined;
  }

  const components = [...elements.matchAll(/^import (\w+) from '\.\/(\w+)';$/gm)]
    .filter(([, name, folder]) => name === folder)
    .map(([, name]) => name);

  return components.length > 0 &&
    elementsRegistry(components) === elements &&
    declarationsRegistry(components) === declarations
    ? components
    : undefined;
};

/**
 * What `plitzi create` wrote, if it did — told by what the project depends on and the files it keeps, never by its
 * name.
 *
 * - A plugin package publishes the SDK as a peer and keeps its elements' lists in `src/`.
 * - A project renders a space: the SDK is a dependency and `src/main.ts` registers the project's plugins — by folder
 *   in a project written since that was how, by a list written in the file before then.
 */
const plitziProject = async (
  root: string,
  packageJson: PackageJson
): Promise<PlitziProject | PluginPackage | undefined> => {
  if (packageJson.peerDependencies?.['@plitzi/plitzi-sdk'] && (await exists(path.join(root, 'src/elements.ts')))) {
    return { kind: 'plugin', components: await packageComponents(root) };
  }

  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const main = await readText(path.join(root, 'src/main.ts'));
  if (!('@plitzi/plitzi-sdk' in dependencies) || main === undefined || !/src\/plugins|\.\/plugins\//.test(main)) {
    return undefined;
  }

  const server = '@plitzi/sdk-server' in dependencies;

  return {
    kind: 'project',
    mode: server ? 'server' : 'client',
    source: (await exists(path.join(root, 'src/space.ts'))) ? 'local' : 'cloud',
    discovers: server
      ? main.includes('readdirSync(PLUGINS_DIR')
      : main.includes('import.meta.glob<{ default: RenderPlugins[string]')
  };
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
