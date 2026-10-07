import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * The `@plitzi` packages a project has installed otherwise than its `package.json` resolves them on the registry — a
 * tarball installed with `npm install --no-save`, a folder linked in, a `file:` or `portal:` range, an override. An
 * install puts the registry's in their place, so whatever installs on the project's behalf (`plitzi upgrade`) leaves
 * them, and says which and how they came.
 */

const SCOPE = '@plitzi';

export interface LocalPackage {
  name: string;
  /** How it came, in words: `installed from file:../tgz/sdk.tgz`, `linked to ../sdk`, `package.json asks for file:…`. */
  from: string;
}

/** A range the registry does not answer: a path, a tarball, a protocol of a manager's own, a repository. */
const NOT_REGISTRY = /^(?:file|link|portal|workspace|git\+?\w*|github|https?):|^(?:\.{0,2}\/|~\/)|\.(?:tgz|tar\.gz)$/;

/** The `@plitzi` package an override or a resolution names: `@plitzi/sdk`, `**\/@plitzi/sdk`, `@plitzi/sdk@0.38`. */
const SCOPED_NAME = /(@plitzi\/[\w.-]+?)(?:@[^/]*)?$/;

const readJson = async (file: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf-8'));

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const stringsOf = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

/** The folder Node finds the scope in from the project's root: the nearest `node_modules/@plitzi`, here or above. */
const scopeFolder = async (root: string): Promise<string | undefined> => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', SCOPE);
    if (
      await fs.stat(candidate).then(
        stat => stat.isDirectory(),
        () => false
      )
    ) {
      return candidate;
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
};

/** What `package.json` asks for that no registry answers. */
const declaredLocally = (manifest: Record<string, unknown>): LocalPackage[] =>
  Object.entries({ ...stringsOf(manifest.devDependencies), ...stringsOf(manifest.dependencies) })
    .filter(([name, range]) => name.startsWith(`${SCOPE}/`) && NOT_REGISTRY.test(range.trim()))
    .map(([name, range]) => ({ name, from: `package.json asks for ${range}` }));

/** What `package.json` overrides: npm's `overrides`, Yarn's `resolutions`, pnpm's `pnpm.overrides`. */
const overridden = (manifest: Record<string, unknown>): LocalPackage[] => {
  const fields: [string, unknown][] = [
    ['overrides', manifest.overrides],
    ['resolutions', manifest.resolutions],
    ['pnpm.overrides', isRecord(manifest.pnpm) ? manifest.pnpm.overrides : undefined]
  ];

  return fields.flatMap(([field, value]) =>
    Object.entries(isRecord(value) ? value : {}).flatMap(([key, to]) => {
      const name = SCOPED_NAME.exec(key)?.[1];

      return name ? [{ name, from: `package.json overrides it ("${field}": ${JSON.stringify(to)})` }] : [];
    })
  );
};

/** A package of the scope that is a link: `npm link`, a folder installed, a portal, a workspace's package. */
const linked = async (root: string, scope: string): Promise<LocalPackage[]> => {
  const entries = await fs.readdir(scope, { withFileTypes: true }).catch(() => []);
  const links = entries.filter(entry => entry.isSymbolicLink());

  return Promise.all(
    links.map(async entry => {
      const target = await fs.realpath(path.join(scope, entry.name)).catch(() => path.join(scope, entry.name));

      return { name: `${SCOPE}/${entry.name}`, from: `linked to ${path.relative(root, target) || '.'}` };
    })
  );
};

/** One package of the scope as npm recorded it: what is installed (`node_modules/.package-lock.json`), or saved. */
const npmEntries = (lock: Record<string, unknown> | undefined): Map<string, { version?: string; resolved?: string }> =>
  new Map(
    Object.entries(isRecord(lock?.packages) ? lock.packages : {}).flatMap(([key, entry]) => {
      const name = key.startsWith(`node_modules/${SCOPE}/`) ? key.slice('node_modules/'.length) : undefined;
      if (!name || name.includes('/node_modules/') || !isRecord(entry)) {
        return [];
      }

      return [
        [
          name,
          {
            ...(typeof entry.version === 'string' ? { version: entry.version } : {}),
            ...(typeof entry.resolved === 'string' ? { resolved: entry.resolved } : {})
          }
        ]
      ];
    })
  );

/**
 * What npm installed that its lockfile does not say: a tarball or a folder installed by hand — `resolved` is a
 * `file:` — or another version than the one saved, which `npm install --no-save` leaves behind.
 */
const installedByHand = async (scope: string): Promise<LocalPackage[]> => {
  const modules = path.dirname(scope);
  const installed = npmEntries(await readJson(path.join(modules, '.package-lock.json')));
  const saved = npmEntries(await readJson(path.join(path.dirname(modules), 'package-lock.json')));

  return [...installed].flatMap(([name, { version, resolved }]) => {
    if (resolved?.startsWith('file:')) {
      return [{ name, from: `installed from ${resolved}, not from the registry` }];
    }

    const lockVersion = saved.get(name)?.version;
    if (version && lockVersion && version !== lockVersion) {
      return [{ name, from: `installed at ${version} by hand — package-lock.json has ${lockVersion}` }];
    }

    return [];
  });
};

/** Every `@plitzi` package the project has installed locally, each once, said by the first of the ways it came. */
export const localPackages = async (root: string): Promise<LocalPackage[]> => {
  const manifest = (await readJson(path.join(root, 'package.json'))) ?? {};
  const scope = await scopeFolder(root);
  const found = [
    ...declaredLocally(manifest),
    ...overridden(manifest),
    ...(scope ? await linked(root, scope) : []),
    ...(scope ? await installedByHand(scope) : [])
  ];
  const byName = new Map<string, LocalPackage>();
  for (const local of found) {
    if (!byName.has(local.name)) {
      byName.set(local.name, local);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};
