import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { projectHere, readPackageJson } from './existingProject';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from './scaffoldRecord';
import { fail, install, writeFiles } from './terminal';
import { unifiedDiff } from '../fix/diff';
import { detectManagerVersion, installCommand, machineryFiles } from '../scaffold';
import { CLI_VERSION, packageJson } from '../scaffold/project';
import { SKILL_NAMES, skillFiles, skillVersion } from '../scaffold/skills';

import type { PlitziProject } from './existingProject';
import type { CreateAnswers } from '../scaffold';

/**
 * `plitzi upgrade`: a project brought up to the CLI it now has — what `create` would write today, for what is the
 * CLI's to write. Every part on its own, or all of them:
 *
 * - `files`: the machinery (`machineryFiles`) — `author.ts`, `main.ts`, the Playwright and lint configs, AGENTS.md. One
 *   nobody changed since the CLI wrote it is replaced; one the project made its own is shown as a diff and left, unless
 *   `--take` names it.
 * - `packages`: `package.json` merged — the scripts and dependencies it lacks added, `@plitzi/*` raised to this
 *   version. A script or a dependency the project has is never changed; then the install.
 * - `skills`: `.claude/skills/plitzi-*` from the packages installed, each replaced whole.
 * - `renames`: a name a version renamed, still written in the source (`canTemplate`), at its file and line — and with
 *   `--write`, renamed.
 *
 * Shown by default; `--write` makes it. What the space is — its pages, plugins, data — is the project's, never named.
 *
 *   plitzi upgrade                    # everything, as it would be
 *   plitzi upgrade skills --write     # only the skills
 *   plitzi upgrade --write --take src/author.ts
 */

export const UPGRADE_PARTS = ['files', 'packages', 'skills', 'renames'] as const;

export type UpgradePart = (typeof UPGRADE_PARTS)[number];

export interface UpgradeOptions {
  write?: boolean;
  /** Files of the project's own to replace anyway — `all` for every one. */
  take?: string[];
  json?: boolean;
  /** `--no-install`: write `package.json` and leave the install to the author. */
  install?: boolean;
}

// --- renames -------------------------------------------------------------------------------------------------------

/**
 * A name a version renamed with no alias, still to be found in a project's own source.
 *
 * `from` an import names it only in a file that imports it from that package — `TemplateSpec` may be a project's own
 * type; a key (`canTemplate`) is renamed wherever it is written, being a name nothing else uses.
 */
interface Rename {
  name: string;
  to: string;
  since: string;
  what: string;
  from?: string;
}

const RENAMES: readonly Rename[] = [
  { name: 'canTemplate', to: 'canSnippet', since: '0.38.0', what: 'a plugin’s builder config key' },
  ...['authorTemplate', 'validateTemplate', 'TemplateSpec', 'AuthoredTemplate'].map(name => ({
    name,
    to: name.replace('Template', 'Snippet'),
    since: '0.38.0',
    what: 'what the builder saves from a subtree is a snippet',
    from: '@plitzi/sdk-authoring'
  }))
];

interface RenameFound {
  file: string;
  line: number;
  name: string;
  to: string;
  since: string;
  what: string;
}

/** The project's own source: TypeScript and JavaScript under `src/` and `visual/`, never what was installed or built. */
const sourceFiles = async (root: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(relative);
      } else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry.name)) {
        found.push(relative);
      }
    }
  };
  await walk('src');
  await walk('visual');

  return found;
};

const wordOf = (name: string): RegExp => new RegExp(`\\b${name}\\b`, 'g');

const importsFrom = (text: string, name: string, from: string): boolean =>
  new RegExp(`import\\s+(type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${from}['"]`).test(text);

const renamesIn = (file: string, text: string): RenameFound[] =>
  RENAMES.filter(rename => !rename.from || importsFrom(text, rename.name, rename.from)).flatMap(rename =>
    text
      .split('\n')
      .flatMap((line, index) =>
        wordOf(rename.name).test(line)
          ? [{ file, line: index + 1, name: rename.name, to: rename.to, since: rename.since, what: rename.what }]
          : []
      )
  );

// --- packages ------------------------------------------------------------------------------------------------------

type Section = 'dependencies' | 'devDependencies';

interface PackagesPlan {
  added: { section: Section; name: string; range: string }[];
  raised: { section: Section; name: string; from: string; to: string }[];
  scripts: { name: string; command: string }[];
  /** Scripts the project wrote otherwise: left as they are, and said. */
  ownScripts: { name: string; yours: string; ours: string }[];
  /** The merged file, when anything changes. */
  after?: string;
}

/** The lowest version a range allows, as numbers: `^0.38.2` → [0, 38, 2]. */
const floorOf = (range: string): number[] | undefined => {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(range);

  return match ? match.slice(1).map(Number) : undefined;
};

const isBelow = (range: string, than: string): boolean => {
  const [a, b] = [floorOf(range), floorOf(than)];
  if (!a || !b) {
    return false;
  }

  const at = a.findIndex((part, index) => part !== b[index]);

  return at !== -1 && a[at] < b[at];
};

const stringsOf = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

const planPackages = (text: string, answers: CreateAnswers): PackagesPlan => {
  const parsed: unknown = JSON.parse(text);
  const ours: unknown = JSON.parse(packageJson(answers));
  const project = isRecord(parsed) ? { ...parsed } : {};
  const scaffold = isRecord(ours) ? ours : {};
  const plan: PackagesPlan = { added: [], raised: [], scripts: [], ownScripts: [] };

  const scripts = stringsOf(project.scripts);
  for (const [name, command] of Object.entries(stringsOf(scaffold.scripts))) {
    if (!(name in scripts)) {
      plan.scripts.push({ name, command });
      scripts[name] = command;
    } else if (scripts[name] !== command) {
      plan.ownScripts.push({ name, yours: scripts[name], ours: command });
    }
  }

  const sections: Record<Section, Record<string, string>> = {
    dependencies: stringsOf(project.dependencies),
    devDependencies: stringsOf(project.devDependencies)
  };
  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const [name, range] of Object.entries(stringsOf(scaffold[section]))) {
      const where =
        name in sections.dependencies
          ? 'dependencies'
          : name in sections.devDependencies
            ? 'devDependencies'
            : undefined;
      if (!where) {
        plan.added.push({ section, name, range });
        sections[section][name] = range;
      } else if (name.startsWith('@plitzi/') && isBelow(sections[where][name], range)) {
        plan.raised.push({ section: where, name, from: sections[where][name], to: range });
        sections[where][name] = range;
      }
    }
  }

  if (plan.added.length + plan.raised.length + plan.scripts.length === 0) {
    return plan;
  }

  const sorted = (entries: Record<string, string>) =>
    Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  // The project's own indentation, so the change is the lines that changed and not every line of the file.
  const indent = /^\{\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  const merged = {
    ...project,
    scripts,
    dependencies: sorted(sections.dependencies),
    devDependencies: sorted(sections.devDependencies)
  };

  return { ...plan, after: `${JSON.stringify(merged, null, indent)}\n` };
};

// --- files ---------------------------------------------------------------------------------------------------------

type FileStatus = 'current' | 'added' | 'updated' | 'yours' | 'taken';

interface FilePlan {
  file: string;
  status: FileStatus;
  /** What the CLI writes now. */
  ours: string;
  /** What the project has, when it has the file. */
  yours?: string;
}

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

const planFiles = async (
  root: string,
  files: Record<string, string>,
  recorded: Record<string, string>,
  take: readonly string[]
): Promise<FilePlan[]> =>
  Promise.all(
    Object.entries(files).map(async ([file, ours]): Promise<FilePlan> => {
      const yours = await readText(path.join(root, file));
      if (yours === undefined) {
        return { file, status: 'added', ours };
      }

      if (yours === ours) {
        return { file, status: 'current', ours, yours };
      }

      if (recorded[file] === digestOf(yours)) {
        return { file, status: 'updated', ours, yours };
      }

      return { file, status: take.includes('all') || take.includes(file) ? 'taken' : 'yours', ours, yours };
    })
  );

const WRITES: ReadonlySet<FileStatus> = new Set(['added', 'updated', 'taken']);

// --- skills --------------------------------------------------------------------------------------------------------

interface SkillPlan {
  name: string;
  was?: string;
  now?: string;
}

const planSkills = async (root: string): Promise<{ plans: SkillPlan[]; files: Record<string, string> }> => {
  const files = skillFiles(SKILL_NAMES, root);
  const plans: SkillPlan[] = [];
  for (const name of SKILL_NAMES) {
    const skill = `.claude/skills/${name}/SKILL.md`;
    // A skill whose package is not installed here is one the project goes on without.
    if (!(skill in files)) {
      continue;
    }

    const now = files[skill];
    const was = await readText(path.join(root, skill));
    if (was !== now) {
      plans.push({
        name,
        ...(was === undefined ? {} : { was: skillVersion(was) ?? 'unversioned' }),
        now: skillVersion(now) ?? 'unversioned'
      });
    }
  }

  return { plans, files };
};

const writeSkills = async (root: string, plans: readonly SkillPlan[], files: Record<string, string>): Promise<void> => {
  for (const { name } of plans) {
    // Each replaced whole: a reference the new one no longer has goes with the old one.
    await fs.rm(path.join(root, '.claude/skills', name), { recursive: true, force: true });
    await writeFiles(
      root,
      Object.fromEntries(Object.entries(files).filter(([file]) => file.startsWith(`.claude/skills/${name}/`)))
    );
  }
};

// --- the command ---------------------------------------------------------------------------------------------------

/** What a project was made with, as far as its machinery cares: none of it reads the key or the environment. */
const answersFor = async (root: string, plitzi: PlitziProject, manager: CreateAnswers['packageManager']) => {
  const name = (await readPackageJson(root))?.name ?? path.basename(root);
  const managerVersion = detectManagerVersion(manager, root);
  const answers: CreateAnswers = {
    name,
    mode: plitzi.mode,
    source: plitzi.source,
    key: '',
    environment: 'main',
    packageManager: manager,
    ...(managerVersion === undefined ? {} : { managerVersion })
  };

  return answers;
};

interface UpgradeReport {
  version: string;
  write: boolean;
  files?: { file: string; status: FileStatus; diff?: string }[];
  packages?: Omit<PackagesPlan, 'after'> & { install?: 'done' | 'failed' | 'needed' };
  skills?: SkillPlan[];
  renames?: RenameFound[];
}

const statusLine: Record<FileStatus, (file: string) => string> = {
  current: file => chalk.dim(`  = ${file}`),
  added: file => chalk.green(`  + ${file}`),
  updated: file => chalk.green(`  ~ ${file}`),
  taken: file => chalk.yellow(`  ~ ${file} (yours, taken)`),
  yours: file => chalk.yellow(`  ! ${file} — yours: the CLI's version below; --take ${file} to replace it`)
};

const reportText = (report: UpgradeReport): string => {
  const lines = [chalk.bold(`plitzi upgrade → ${report.version}${report.write ? '' : ' (shown; --write makes it)'}`)];
  if (report.files) {
    const changed = report.files.filter(file => file.status !== 'current');
    lines.push(changed.length === 0 ? chalk.green('files: up to date') : 'files:');
    for (const file of changed) {
      lines.push(statusLine[file.status](file.file));
      if (file.diff) {
        lines.push(chalk.dim(file.diff));
      }
    }
  }

  if (report.packages) {
    const { added, raised, scripts, ownScripts, install: installed } = report.packages;
    const none = added.length + raised.length + scripts.length === 0;
    lines.push(none ? chalk.green('packages: up to date') : 'packages:');
    lines.push(
      ...raised.map(entry => chalk.green(`  ~ ${entry.name} ${entry.from} → ${entry.to}`)),
      ...added.map(entry => chalk.green(`  + ${entry.name} ${entry.range} (${entry.section})`)),
      ...scripts.map(entry => chalk.green(`  + script ${entry.name}: ${entry.command}`)),
      ...ownScripts.map(entry =>
        chalk.dim(`  = script ${entry.name} is yours ("${entry.yours}"; the CLI writes "${entry.ours}")`)
      )
    );
    if (installed === 'needed') {
      lines.push(chalk.yellow('  then install, for the new versions to be the ones that run'));
    } else if (installed === 'failed') {
      lines.push(chalk.red('  the install failed: the reason is in the output above'));
    }
  }

  if (report.skills) {
    lines.push(report.skills.length === 0 ? chalk.green('skills: up to date') : 'skills:');
    lines.push(
      ...report.skills.map(skill => chalk.green(`  ~ ${skill.name}: ${skill.was ?? 'none'} → ${skill.now ?? '?'}`))
    );
  }

  if (report.renames) {
    lines.push(report.renames.length === 0 ? chalk.green('renames: none written') : 'renames:');
    lines.push(
      ...report.renames.map(found =>
        chalk.yellow(
          `  ${report.write ? '~' : '!'} ${found.file}:${String(found.line)} ${found.name} → ${found.to} (${found.since}: ${found.what})`
        )
      )
    );
  }

  return lines.join('\n');
};

export const upgrade = async (parts: readonly string[], options: UpgradeOptions): Promise<void> => {
  const unknown = parts.filter(part => !(UPGRADE_PARTS as readonly string[]).includes(part));
  if (unknown.length > 0) {
    fail(`Not a part of a project to upgrade: ${unknown.join(', ')}. The parts are ${UPGRADE_PARTS.join(', ')}.`);

    return;
  }

  const project = await projectHere('to upgrade');
  if (!project) {
    return;
  }

  const wanted = new Set<string>(parts.length === 0 ? UPGRADE_PARTS : parts);
  const { root } = project;
  const manager = project.packageManager ?? 'npm';
  const write = Boolean(options.write);
  const report: UpgradeReport = { version: CLI_VERSION, write };

  // The machinery and package.json are what `create` would write, which takes knowing how it was made; the skills and
  // the renames are the same in any project.
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  if (!plitzi && (wanted.has('files') || wanted.has('packages'))) {
    fail(
      'Its files and package.json are those of a project `plitzi create` wrote, and this is not one: `plitzi upgrade skills renames` brings up the rest.'
    );

    return;
  }

  const answers = plitzi ? await answersFor(root, plitzi, manager) : undefined;

  if (answers && wanted.has('files')) {
    const ours = machineryFiles(answers);
    const recorded = (await readScaffoldRecord(root))?.files ?? {};
    const plans = await planFiles(root, ours, recorded, options.take ?? []);
    if (write) {
      const written = plans.filter(plan => WRITES.has(plan.status));
      await writeFiles(root, Object.fromEntries(written.map(plan => [plan.file, plan.ours])));
      // What is the CLI's version now is recorded as the CLI's; a file left the project's keeps what was recorded.
      const digests = Object.fromEntries(
        plans.flatMap((plan): [string, string][] => {
          if (WRITES.has(plan.status) || plan.status === 'current') {
            return [[plan.file, digestOf(plan.ours)]];
          }

          return plan.file in recorded ? [[plan.file, recorded[plan.file]]] : [];
        })
      );
      await writeScaffoldRecord(root, CLI_VERSION, digests);
    }

    report.files = plans.map(plan => ({
      file: plan.file,
      status: plan.status,
      ...(plan.status === 'yours' && plan.yours !== undefined
        ? { diff: unifiedDiff(plan.file, plan.yours, plan.ours) }
        : {})
    }));
  }

  if (answers && wanted.has('packages')) {
    const text = await readText(path.join(root, 'package.json'));
    const plan = text === undefined ? undefined : planPackages(text, answers);
    if (plan) {
      const { after, ...rest } = plan;
      let installed: 'done' | 'failed' | 'needed' | undefined;
      if (after !== undefined) {
        installed = 'needed';
        if (write) {
          await fs.writeFile(path.join(root, 'package.json'), after);
          if (options.install !== false && !options.json) {
            installed = (await install(manager, root)) ? 'done' : 'failed';
          }
        }
      }

      report.packages = { ...rest, ...(installed === undefined ? {} : { install: installed }) };
    }
  }

  // After the install: the skills come from the packages now installed.
  if (wanted.has('skills')) {
    const { plans, files } = await planSkills(root);
    if (write) {
      await writeSkills(root, plans, files);
    }

    report.skills = plans;
  }

  if (wanted.has('renames')) {
    const found: RenameFound[] = [];
    for (const file of await sourceFiles(root)) {
      const text = await readText(path.join(root, file));
      const inFile = text === undefined ? [] : renamesIn(file, text);
      if (write && text !== undefined && inFile.length > 0) {
        const renamed = [...new Set(inFile.map(entry => entry.name))].reduce(
          (result, name) => result.replace(wordOf(name), RENAMES.find(rename => rename.name === name)?.to ?? name),
          text
        );
        await fs.writeFile(path.join(root, file), renamed);
      }

      found.push(...inFile);
    }

    report.renames = found;
  }

  console.log(options.json ? JSON.stringify(report) : reportText(report));
  if (report.packages?.install === 'failed') {
    process.exitCode = 1;
    console.error(chalk.dim(`\`${installCommand(manager)}\` failed.`));
  }
};
