import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { sayer } from './types';
import { compareVersions, floorOf, satisfies, versionOf, versionText } from './versions';
import { planPackages } from '../commands/upgrade';
import { installCommand } from '../scaffold';
import { CLI_VERSION, NODE_ENGINES, SDK_VERSION, packageJson } from '../scaffold/project';

import type { Check, DoctorContext, Finding } from './types';

/**
 * `package.json` and what it installed: the packages the project's own code and the CLI's need, declared and installed
 * at versions that agree — one copy of the SDK and of React, never two — the scripts, and the Node that runs them.
 */

const say = sayer('packages');

const UPGRADE_PACKAGES = 'plitzi upgrade packages --write';

/** Without these the project does not start, author or build: missing, they are errors, any other a warning. */
const ESSENTIAL_SCRIPTS: ReadonlySet<string> = new Set(['start', 'start:dev', 'build', 'start:prod', 'author']);

const LOCKFILES = { 'package-lock.json': 'npm', 'yarn.lock': 'yarn', 'pnpm-lock.yaml': 'pnpm' } as const;

const stringsOf = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

type Installed = { dir: string; version: string };

const readManifest = async (dir: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Where Node finds a package from the project's root, and its version: the nearest `node_modules` holding it. */
const installedOf = async (root: string, name: string): Promise<Installed | undefined> => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    const manifest = await readManifest(candidate);
    if (manifest && typeof manifest.version === 'string') {
      return { dir: await fs.realpath(candidate), version: manifest.version };
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
};

/** Whether anything is installed for the project at all: a `node_modules` here or in a workspace above. */
const hasNodeModules = async (root: string): Promise<boolean> => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    if (
      await fs.stat(path.join(dir, 'node_modules')).then(
        stat => stat.isDirectory(),
        () => false
      )
    ) {
      return true;
    }

    if (path.dirname(dir) === dir) {
      return false;
    }
  }
};

/**
 * A second copy of a package a page must hold once, installed inside another: a second React breaks every hook, and a
 * second SDK a second runtime that the first never sees.
 */
const nestedCopies = async (installed: Installed, singletons: readonly string[]): Promise<string[]> =>
  (
    await Promise.all(
      singletons.map(async name => ((await readManifest(path.join(installed.dir, 'node_modules', name))) ? [name] : []))
    )
  ).flat();

const declaredRanges = (context: DoctorContext): Record<string, string> => ({
  ...stringsOf(context.manifest.devDependencies),
  ...stringsOf(context.manifest.dependencies)
});

const manifestChecks = (context: DoctorContext): Finding[] => {
  const findings: Finding[] = [];
  if (context.manifest.type !== 'module') {
    findings.push(
      say.error(
        'not-esm',
        'package.json does not say "type": "module": Node reads every file of the project as CommonJS.',
        {
          file: 'package.json',
          fix: 'Add "type": "module" to package.json.'
        }
      )
    );
  }

  const engines = isRecord(context.manifest.engines) ? context.manifest.engines.node : undefined;
  if (typeof engines !== 'string') {
    findings.push(
      say.warning(
        'engines-missing',
        `package.json names no Node version: the project needs Node ${NODE_ENGINES.node}.`,
        {
          file: 'package.json',
          fix: `Add "engines": { "node": "${NODE_ENGINES.node}" } to package.json.`
        }
      )
    );
  }

  const running = versionOf(process.versions.node);
  const needed = floorOf(NODE_ENGINES.node);
  if (running && needed && compareVersions(running, needed) < 0) {
    findings.push(
      say.error(
        'node-too-old',
        `Node ${process.versions.node} runs this, and the project needs ${NODE_ENGINES.node}: it runs its TypeScript by stripping the types, which older versions cannot.`,
        { fix: `Install Node ${versionText(needed)} or newer.` }
      )
    );
  }

  return findings;
};

/** What the CLI writes into `package.json` that the project lacks or holds older, and the scripts it changed. */
const scaffoldChecks = async (context: DoctorContext): Promise<Finding[]> => {
  const text = await fs.readFile(path.join(context.root, 'package.json'), 'utf-8');
  const plan = planPackages(text, context.answers, context.record?.scripts);
  const findings: Finding[] = [];
  for (const { section, name, range } of plan.added) {
    findings.push(
      (section === 'dependencies' ? say.error : say.warning)(
        'dependency-missing',
        `${name} is not in package.json: ${section === 'dependencies' ? 'the project imports it' : 'a script of the project runs it'} (${range}).`,
        { file: 'package.json', fix: UPGRADE_PACKAGES }
      )
    );
  }

  for (const { name, from, to } of plan.raised) {
    findings.push(
      say.warning('sdk-behind', `${name} is ${from}, behind this CLI (${to}): what it writes is for ${to}.`, {
        file: 'package.json',
        fix: UPGRADE_PACKAGES
      })
    );
  }

  for (const { name, command } of plan.scripts) {
    findings.push(
      (ESSENTIAL_SCRIPTS.has(name) ? say.error : say.warning)(
        'script-missing',
        `The script ${name} is gone: the CLI's is "${command}".`,
        { file: 'package.json', fix: UPGRADE_PACKAGES }
      )
    );
  }

  for (const { name, to } of plan.updatedScripts) {
    findings.push(
      say.warning('script-outdated', `The script ${name} is as an older CLI wrote it: this one writes "${to}".`, {
        file: 'package.json',
        fix: UPGRADE_PACKAGES
      })
    );
  }

  for (const { name, yours } of plan.ownScripts) {
    findings.push(
      say.info('script-yours', `The script ${name} is the project's own: "${yours}".`, { file: 'package.json' })
    );
  }

  return findings;
};

/** The scripts that start Node on a file of the project — not `start:prod`, whose file `build` writes. */
const NODE_SCRIPTS = ['start', 'start:dev', 'author'] as const;

/**
 * What a script that runs Node needs on disk: the file it starts, and every folder `--watch-path` names — Node stops at
 * start when one of them is not there, which is why each watched folder keeps a `.gitkeep`.
 */
const scriptTargetChecks = async ({ root, manifest }: DoctorContext): Promise<Finding[]> => {
  const scripts = stringsOf(manifest.scripts);
  const findings: Finding[] = [];
  for (const name of NODE_SCRIPTS) {
    const command = scripts[name];
    const words = command && /^node\s/.test(command) ? command.split(/\s+/).slice(1) : [];
    const watched = words.flatMap(word => /^--watch-path=(.+)$/.exec(word)?.[1] ?? []);
    const started = words.filter(word => !word.startsWith('-')).at(-1);
    for (const folder of watched) {
      if (
        !(await fs.stat(path.join(root, folder)).then(
          () => true,
          () => false
        ))
      ) {
        findings.push(
          say.error(
            'watch-path-missing',
            `The script ${name} watches ${folder}, which is not there: Node stops before it starts.`,
            {
              file: 'package.json',
              fix: `Create ${folder} (with a .gitkeep, so git keeps it), or take the --watch-path out.`
            }
          )
        );
      }
    }

    if (
      started &&
      !(await fs.stat(path.join(root, started)).then(
        stat => stat.isFile(),
        () => false
      ))
    ) {
      findings.push(
        say.error('script-target-missing', `The script ${name} runs ${started}, which is not there.`, {
          file: 'package.json',
          fix: `Point ${name} at the file that starts the project.`
        })
      );
    }
  }

  return findings;
};

/** The SDK's packages are released together: one version for all of them, and the CLI's or newer. */
const sdkVersionChecks = (context: DoctorContext, sdk: readonly string[]): Finding[] => {
  const declared = declaredRanges(context);
  const floors = sdk.flatMap(name => {
    const floor = name in declared ? floorOf(declared[name]) : undefined;

    return floor ? [{ name, floor }] : [];
  });
  const distinct = [...new Set(floors.map(({ floor }) => versionText(floor)))];
  const findings: Finding[] = [];
  if (distinct.length > 1) {
    findings.push(
      say.error(
        'sdk-versions-mixed',
        `The SDK's packages are released together, and package.json names ${distinct.length} versions of them: ${floors.map(({ name, floor }) => `${name} ${versionText(floor)}`).join(', ')}.`,
        { file: 'package.json', fix: UPGRADE_PACKAGES }
      )
    );
  }

  const cli = versionOf(CLI_VERSION);
  const newest = floors
    .map(({ floor }) => floor)
    .sort(compareVersions)
    .at(-1);
  if (cli && newest && compareVersions(newest, cli) > 0) {
    findings.push(
      say.warning(
        'cli-behind',
        `The project is on the SDK ${versionText(newest)}, and this CLI is ${CLI_VERSION}: what it checks and writes is older than the project.`,
        { fix: 'npx @plitzi/cli@latest doctor' }
      )
    );
  }

  return findings;
};

/** What is installed: every package declared, at a version its range allows — and one copy of each that must be one. */
const installChecks = async (context: DoctorContext, sdk: readonly string[]): Promise<Finding[]> => {
  const install = installCommand(context.manager);
  if (!(await hasNodeModules(context.root))) {
    return [say.error('not-installed', 'Nothing is installed: there is no node_modules.', { fix: install })];
  }

  const findings: Finding[] = [];
  const declared = declaredRanges(context);
  const singletons = [...sdk, 'react', 'react-dom'];
  const installed = new Map<string, Installed>();
  for (const [name, range] of Object.entries(declared)) {
    const found = await installedOf(context.root, name);
    if (!found) {
      findings.push(
        say.error('not-installed', `${name} is in package.json and not installed.`, {
          file: 'package.json',
          fix: install
        })
      );
      continue;
    }

    installed.set(name, found);
    if (satisfies(found.version, range) === false) {
      findings.push(
        say.error('installed-mismatch', `${name} ${found.version} is installed, and package.json asks for ${range}.`, {
          file: 'package.json',
          fix: install
        })
      );
    }
  }

  const sdkVersions = [...new Set(sdk.flatMap(name => installed.get(name)?.version ?? []))];
  if (sdkVersions.length > 1) {
    findings.push(
      say.error(
        'installed-mixed',
        `The SDK's packages are installed at ${sdkVersions.length} versions (${sdk.flatMap(name => (installed.has(name) ? [`${name} ${installed.get(name)?.version ?? ''}`] : [])).join(', ')}): they only work together at one.`,
        { fix: `${UPGRADE_PACKAGES}, then ${install}` }
      )
    );
  }

  const react = installed.get('react')?.version;
  const reactDom = installed.get('react-dom')?.version;
  if (react && reactDom && react !== reactDom) {
    findings.push(
      say.error('react-mismatch', `react ${react} and react-dom ${reactDom} are installed: they are one release.`, {
        fix: install
      })
    );
  }

  for (const name of singletons) {
    const found = installed.get(name);
    for (const copy of found ? await nestedCopies(found, singletons) : []) {
      findings.push(
        say.error(
          'duplicate-copy',
          `${name} installed a copy of ${copy} of its own (${path.relative(context.root, path.join(found?.dir ?? '', 'node_modules', copy))}): a page would run two of it.`,
          { fix: `Align the versions in package.json, then reinstall (${install}).` }
        )
      );
    }
  }

  return findings;
};

/** One lockfile, the one of the manager the project says it uses. */
const lockfileChecks = async (context: DoctorContext): Promise<Finding[]> => {
  const present = (
    await Promise.all(
      Object.entries(LOCKFILES).map(async ([file, manager]) =>
        (await fs.access(path.join(context.root, file)).then(
          () => true,
          () => false
        ))
          ? [{ file, manager }]
          : []
      )
    )
  ).flat();
  const findings: Finding[] = [];
  if (present.length > 1) {
    findings.push(
      say.warning(
        'lockfiles-mixed',
        `The project has ${present.length} lockfiles (${present.map(({ file }) => file).join(', ')}): each manager installs its own versions.`,
        { fix: `Keep the one of ${context.manager}, and delete the rest.` }
      )
    );
  }

  const declared = typeof context.manifest.packageManager === 'string' ? context.manifest.packageManager : undefined;
  const named = declared?.split('@')[0];
  if (named && present.length === 1 && present[0].manager !== named) {
    findings.push(
      say.warning(
        'manager-mismatch',
        `package.json says it installs with ${named}, and its lockfile is ${present[0].file}.`,
        { file: 'package.json', fix: `Install with ${named}, or change "packageManager".` }
      )
    );
  }

  return findings;
};

export const checkPackages: Check = async context => {
  const scaffold: unknown = JSON.parse(packageJson(context.answers));
  const ours = isRecord(scaffold)
    ? { ...stringsOf(scaffold.dependencies), ...stringsOf(scaffold.devDependencies) }
    : {};
  // The SDK's packages are those the CLI writes at its own version: the ones released together.
  const sdk = Object.keys(ours).filter(name => ours[name] === SDK_VERSION);

  return [
    ...manifestChecks(context),
    ...(await scaffoldChecks(context)),
    ...(await scriptTargetChecks(context)),
    ...sdkVersionChecks(context, sdk),
    ...(await installChecks(context, sdk)),
    ...(await lockfileChecks(context))
  ];
};
