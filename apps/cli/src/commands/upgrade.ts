import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { lockfileManager, projectHere, readPackageJson } from './existingProject';
import { blockingLegacy } from './legacyLayout';
import { localPackages } from './localPackages';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from './scaffoldRecord';
import { readOrigin } from './spaceOrigin';
import { fail, install, writeFiles } from './terminal';
import { unifiedDiff } from '../fix/diff';
import { detectManagerVersion, installCommand, machineryFiles, seedFiles } from '../scaffold';
import { RETIRED_MACHINERY } from '../scaffold/machinery';
import { CLI_VERSION, packageJson } from '../scaffold/project';
import { SKILL_NAMES, skillFiles, skillVersion } from '../scaffold/skills';

import type { PlitziProject } from './existingProject';
import type { LocalPackage } from './localPackages';
import type { SpaceOrigin } from './spaceOrigin';
import type { CreateAnswers } from '../scaffold';

/**
 * `plitzi upgrade`: a project brought up to the CLI it now has — what `create` would write today, for what is the
 * CLI's to write. Every part on its own, or all of them:
 *
 * - `files`: the machinery (`machineryFiles`) — `author.ts`, `main.ts`, the Playwright and lint configs, AGENTS.md. One
 *   nobody changed since the CLI wrote it is replaced; one the project made its own is shown as a diff and left, unless
 *   `--take` names it. One the CLI no longer writes (`RETIRED_MACHINERY`) is removed the same way.
 * - `packages`: `package.json` merged — the scripts and dependencies it lacks added, `@plitzi/*` raised to this
 *   version. A dependency the project has is never changed, nor a script it changed — one the CLI wrote and nobody touched
 *   since (the scaffold record) takes today's command; then the install. A `@plitzi` package installed otherwise than
 *   the registry has it (`localPackages`: a tarball, a link, an override) is neither raised nor replaced: the install
 *   is left to the author, said with the command that would take the registry's.
 * - `skills`: `.claude/skills/plitzi-*` from the packages installed, each replaced whole.
 * - `renames`: a name a version renamed, still written in the source (`canTemplate`), at its file and line — and with
 *   `--write`, renamed.
 *
 * Shown by default; `--write` makes it. What the space is — its pages, plugins, data — is the project's, never named.
 *
 *   plitzi upgrade                    # everything, as it would be
 *   plitzi upgrade skills --write     # only the skills
 *   plitzi upgrade --write --take plitzi/author.ts
 */

export const UPGRADE_PARTS = ['files', 'packages', 'skills', 'renames'] as const;

export type UpgradePart = (typeof UPGRADE_PARTS)[number];

export interface UpgradeOptions {
  write?: boolean;
  /** Files of the project's own to replace anyway — `all` for every one. */
  take?: string[];
  json?: boolean;
  /**
   * `--no-install`: write `package.json` and leave the install to the author — as it is left anyway while a `@plitzi`
   * package is installed locally, which an install would replace.
   */
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

export interface PackagesPlan {
  added: { section: Section; name: string; range: string }[];
  raised: { section: Section; name: string; from: string; to: string }[];
  scripts: { name: string; command: string }[];
  /** Scripts the CLI wrote and nobody changed since, brought up to what it writes now. */
  updatedScripts: { name: string; from: string; to: string }[];
  /** Scripts the project wrote otherwise: left as they are, and said. */
  ownScripts: { name: string; yours: string; ours: string }[];
  /** The CLI's scripts as the project has them afterwards — what the record says the CLI wrote. */
  recorded: Record<string, string>;
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

/**
 * `package.json` brought up to the CLI. `wrote` is what the CLI wrote of its scripts (the scaffold record): one the
 * project still has as written is the CLI's and takes today's command; one it changed is its own and is only said.
 * `local` names the packages installed locally, whose range is the project's to change with what it installs.
 */
export const planPackages = (
  text: string,
  answers: CreateAnswers,
  wrote: Record<string, string> = {},
  local: ReadonlySet<string> = new Set()
): PackagesPlan => {
  const parsed: unknown = JSON.parse(text);
  const ours: unknown = JSON.parse(packageJson(answers));
  const project = isRecord(parsed) ? { ...parsed } : {};
  const scaffold = isRecord(ours) ? ours : {};
  const plan: PackagesPlan = { added: [], raised: [], scripts: [], updatedScripts: [], ownScripts: [], recorded: {} };

  const scripts = stringsOf(project.scripts);
  for (const [name, command] of Object.entries(stringsOf(scaffold.scripts))) {
    if (!(name in scripts)) {
      plan.scripts.push({ name, command });
      scripts[name] = command;
    } else if (scripts[name] !== command && wrote[name] === scripts[name]) {
      plan.updatedScripts.push({ name, from: scripts[name], to: command });
      scripts[name] = command;
    } else if (scripts[name] !== command) {
      plan.ownScripts.push({ name, yours: scripts[name], ours: command });
    }

    if (scripts[name] === command) {
      plan.recorded[name] = command;
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
      } else if (name.startsWith('@plitzi/') && !local.has(name) && isBelow(sections[where][name], range)) {
        plan.raised.push({ section: where, name, from: sections[where][name], to: range });
        sections[where][name] = range;
      }
    }
  }

  if (plan.added.length + plan.raised.length + plan.scripts.length + plan.updatedScripts.length === 0) {
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

/**
 * `seeded`: a file of the project's own that the machinery imports, written because the project had none. `space`: one
 * a space made into a project gave in the CLI's place (`src/main.ts`, from what the space holds) — `plitzi space pull`'s.
 * `removed`: one the CLI no longer writes, as it wrote it (or taken), deleted; `retired`: one the project changed, left.
 */
export type FileStatus =
  'current' | 'added' | 'updated' | 'yours' | 'taken' | 'seeded' | 'space' | 'removed' | 'retired';

export interface FilePlan {
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

/** Whether `file` is the CLI's once the plan is made: written by it, or already as it writes it. */
const theClisAfter = (plans: readonly FilePlan[], file: string): boolean =>
  plans.some(plan => plan.file === file && (WRITES.has(plan.status) || plan.status === 'current'));

/**
 * The project's own files the machinery imports that it does not have yet — written once, never replaced, and only
 * beside a machinery file of the CLI's that reads them: one the project kept as its own reads nothing of them.
 */
const planSeeds = async (
  root: string,
  seeds: { file: string; contents: string; readBy: string }[],
  plans: readonly FilePlan[]
): Promise<FilePlan[]> => {
  const planned = await Promise.all(
    seeds.map(async ({ file, contents, readBy }): Promise<FilePlan | undefined> =>
      theClisAfter(plans, readBy) && (await readText(path.join(root, file))) === undefined
        ? { file, status: 'seeded', ours: contents }
        : undefined
    )
  );

  return planned.filter((plan): plan is FilePlan => plan !== undefined);
};

/** A file of the machinery an older CLI wrote and this one does not, still in the project. */
export interface RetiredPlan {
  file: string;
  status: 'removed' | 'retired';
}

/**
 * What the CLI no longer writes (`RETIRED_MACHINERY`), still in the project: removed when nobody changed it since the
 * CLI wrote it, or `--take` names it — `retired`, left, when the project did. Only once the machinery file that read it
 * is the CLI's current one: beside one the project made its own, it is still read.
 */
const planRetired = async (
  root: string,
  plans: readonly FilePlan[],
  recorded: Record<string, string>,
  take: readonly string[]
): Promise<RetiredPlan[]> => {
  const planned = await Promise.all(
    Object.entries(RETIRED_MACHINERY).map(async ([file, readBy]): Promise<RetiredPlan | undefined> => {
      const yours = await readText(path.join(root, file));
      if (yours === undefined || !theClisAfter(plans, readBy)) {
        return undefined;
      }

      const asWritten = recorded[file] === digestOf(yours);

      return { file, status: asWritten || take.includes('all') || take.includes(file) ? 'removed' : 'retired' };
    })
  );

  return planned.filter((plan): plan is RetiredPlan => plan !== undefined);
};

/**
 * The machinery as `upgrade` sees it: each file the CLI writes, by what it is to the project (`FileStatus`), the
 * project's own files it reads that the project lacks (`seeds`), the ones it no longer writes still there (`retired`),
 * and the files a space gave in the CLI's place, which are `plitzi space pull`'s (`spaces`). What `plitzi doctor` reads too,
 * so both say the same of every file.
 */
export const machineryPlan = async (
  root: string,
  answers: CreateAnswers,
  { origin, recorded, take = [] }: { origin?: SpaceOrigin; recorded: Record<string, string>; take?: readonly string[] }
): Promise<{ plans: FilePlan[]; seeds: FilePlan[]; retired: RetiredPlan[]; spaces: string[] }> => {
  // A file the space gave in the CLI's place is the space's, kept by `plitzi space pull` — never offered here.
  const given = new Set(Object.keys(origin?.files ?? {}));
  const machinery = Object.entries(machineryFiles(answers));
  const ours = Object.fromEntries(machinery.filter(([file]) => !given.has(file)));
  const plans = await planFiles(root, ours, recorded, take);

  return {
    plans,
    seeds: await planSeeds(root, seedFiles(answers), plans),
    retired: await planRetired(root, plans, recorded, take),
    spaces: machinery.filter(([file]) => given.has(file)).map(([file]) => file)
  };
};

// --- skills --------------------------------------------------------------------------------------------------------

export interface SkillPlan {
  name: string;
  was?: string;
  now?: string;
}

export const planSkills = async (root: string): Promise<{ plans: SkillPlan[]; files: Record<string, string> }> => {
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
export const answersFor = async (
  root: string,
  plitzi: PlitziProject,
  manager: CreateAnswers['packageManager'],
  fromSpace: boolean
) => {
  const name = (await readPackageJson(root))?.name ?? path.basename(root);
  const managerVersion = detectManagerVersion(manager, root);
  const answers: CreateAnswers = {
    name,
    mode: plitzi.mode,
    source: plitzi.source,
    key: '',
    environment: 'main',
    packageManager: manager,
    ...(managerVersion === undefined ? {} : { managerVersion }),
    ...(fromSpace ? { fromSpace } : {}),
    ...(plitzi.runtime ? { runtime: true } : {})
  };

  return answers;
};

interface UpgradeReport {
  version: string;
  write: boolean;
  files?: { file: string; status: FileStatus; diff?: string }[];
  packages?: Omit<PackagesPlan, 'after' | 'recorded'> & {
    /** `skipped`: not run, a `@plitzi` package being installed locally (`local`), which it would replace. */
    install?: 'done' | 'failed' | 'needed' | 'skipped';
    local: LocalPackage[];
  };
  skills?: SkillPlan[];
  renames?: RenameFound[];
}

const statusLine: Record<FileStatus, (file: string) => string> = {
  current: file => chalk.dim(`  = ${file}`),
  added: file => chalk.green(`  + ${file}`),
  updated: file => chalk.green(`  ~ ${file}`),
  seeded: file => chalk.green(`  + ${file} (yours from now on: the CLI's files above read it)`),
  removed: file => chalk.green(`  - ${file} (no longer the CLI's: nothing reads it)`),
  retired: file =>
    chalk.yellow(`  ! ${file} — no longer the CLI's and nothing reads it, but yours: delete it, or --take ${file}`),
  taken: file => chalk.yellow(`  ~ ${file} (yours, taken)`),
  yours: file => chalk.yellow(`  ! ${file} — yours: the CLI's version below; --take ${file} to replace it`),
  space: file => chalk.dim(`  · ${file} — the space's: plitzi space pull writes it as this CLI does`)
};

/** The report as text; `install` is the project's install command, said when the CLI left the install to the author. */
const reportText = (report: UpgradeReport, install: string): string => {
  const lines = [chalk.bold(`plitzi upgrade → ${report.version}${report.write ? '' : ' (shown; --write makes it)'}`)];
  if (report.files) {
    const changed = report.files.filter(file => file.status !== 'current' && file.status !== 'space');
    lines.push(changed.length === 0 ? chalk.green('files: up to date') : 'files:');
    for (const file of changed) {
      lines.push(statusLine[file.status](file.file));
      if (file.diff) {
        lines.push(chalk.dim(file.diff));
      }
    }

    lines.push(...report.files.filter(file => file.status === 'space').map(file => statusLine.space(file.file)));
  }

  if (report.packages) {
    const { added, raised, scripts, updatedScripts, ownScripts, local, install: installed } = report.packages;
    const none = added.length + raised.length + scripts.length + updatedScripts.length === 0;
    lines.push(none ? chalk.green('packages: up to date') : 'packages:');
    lines.push(
      ...raised.map(entry => chalk.green(`  ~ ${entry.name} ${entry.from} → ${entry.to}`)),
      ...added.map(entry => chalk.green(`  + ${entry.name} ${entry.range} (${entry.section})`)),
      ...scripts.map(entry => chalk.green(`  + script ${entry.name}: ${entry.command}`)),
      ...updatedScripts.map(entry => chalk.green(`  ~ script ${entry.name}: ${entry.to}`)),
      ...ownScripts.map(entry =>
        chalk.dim(`  = script ${entry.name} is yours ("${entry.yours}"; the CLI writes "${entry.ours}")`)
      ),
      // One fact said once: a workspace links every package, and a line each says the same thing fifteen times.
      ...(local.length > 3
        ? [
            chalk.yellow(
              `  ! ${String(local.length)} packages are installed locally, not from the registry (${local
                .slice(0, 8)
                .map(entry => entry.name.replace(/^@plitzi\//, ''))
                .join(
                  ', '
                )}${local.length > 8 ? ` and ${String(local.length - 8)} more` : ''}): left as they are — --json says how each came`
            )
          ]
        : local.map(entry => chalk.yellow(`  ! ${entry.name} is installed locally — ${entry.from}: left as it is`)))
    );
    if (installed === 'skipped') {
      lines.push(
        chalk.yellow(
          `  not installed: an install now would put the registry's in place of what is installed locally. Install the new versions the way you installed those — or run \`${install}\` to take the registry's`
        )
      );
    } else if (installed === 'needed') {
      lines.push(chalk.yellow('  then install, for the new versions to be the ones that run'));
    } else if (installed === 'failed') {
      lines.push(chalk.red('  the install failed: the reason is in the output above'));
    }
  }

  if (report.skills) {
    lines.push(report.skills.length === 0 ? chalk.green('skills: up to date') : 'skills:');
    lines.push(
      // One version on both sides is still a different skill: it was written before this build of the same version.
      ...report.skills.map(skill =>
        chalk.green(
          skill.was !== undefined && skill.was === skill.now
            ? `  ~ ${skill.name}: ${skill.now} — what it says changed within that version`
            : `  ~ ${skill.name}: ${skill.was ?? 'none'} → ${skill.now ?? '?'}`
        )
      )
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
  const record = await readScaffoldRecord(root);
  // The project's own lockfile first — what it installs with now — then what the CLI wrote it for, which a lockfile of
  // a folder above it (a monorepo it sits in) does not overrule.
  const manager = (await lockfileManager([root])) ?? record?.packageManager ?? project.packageManager ?? 'npm';
  const origin = await readOrigin(root);
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

  // A layout an older CLI left reads as another project — a space still in `src/space.ts` as one on Plitzi — and what
  // would be written for that one is not this project's: it is moved first.
  const older = plitzi && (wanted.has('files') || wanted.has('packages')) ? await blockingLegacy(root) : [];
  if (older.length > 0) {
    fail(
      `This project is laid out as an older CLI laid it out (${older.map(place => place.found).join(', ')}), and its files would be written for another project.\n` +
        'Move it first — npx @plitzi/cli@latest doctor --fix moves it, every import following — then upgrade.'
    );

    return;
  }

  const answers = plitzi ? await answersFor(root, plitzi, manager, origin !== undefined) : undefined;

  if (answers && wanted.has('files')) {
    const recorded = record?.files ?? {};
    const { plans, seeds, retired, spaces } = await machineryPlan(root, answers, {
      ...(origin ? { origin } : {}),
      recorded,
      take: options.take ?? []
    });
    if (write) {
      const written = [...plans.filter(plan => WRITES.has(plan.status)), ...seeds];
      await writeFiles(root, Object.fromEntries(written.map(plan => [plan.file, plan.ours])));
      for (const { file } of retired.filter(plan => plan.status === 'removed')) {
        await fs.rm(path.join(root, file), { force: true });
      }

      // What is the CLI's version now is recorded as the CLI's; a file left the project's keeps what was recorded.
      const digests = Object.fromEntries(
        plans.flatMap((plan): [string, string][] => {
          if (WRITES.has(plan.status) || plan.status === 'current') {
            return [[plan.file, digestOf(plan.ours)]];
          }

          return plan.file in recorded ? [[plan.file, recorded[plan.file]]] : [];
        })
      );
      // One the CLI no longer writes, still read by a file the project made its own, keeps what was recorded of it: it
      // is removed once that file is the CLI's again.
      for (const file of Object.keys(RETIRED_MACHINERY)) {
        const planned = retired.some(plan => plan.file === file);
        if (!planned && file in recorded && (await readText(path.join(root, file))) !== undefined) {
          digests[file] = recorded[file];
        }
      }

      await writeScaffoldRecord(root, CLI_VERSION, { files: digests, packageManager: manager });
    }

    report.files = [
      ...[...plans, ...seeds].map(plan => ({
        file: plan.file,
        status: plan.status,
        ...(plan.status === 'yours' && plan.yours !== undefined
          ? { diff: unifiedDiff(plan.file, plan.yours, plan.ours) }
          : {})
      })),
      ...retired,
      ...spaces.map(file => ({ file, status: 'space' as const }))
    ];
  }

  if (answers && wanted.has('packages')) {
    const text = await readText(path.join(root, 'package.json'));
    const wrote = record?.scripts;
    const local = await localPackages(root);
    const plan =
      text === undefined ? undefined : planPackages(text, answers, wrote, new Set(local.map(entry => entry.name)));
    if (plan) {
      const { after, recorded, ...rest } = plan;
      let installed: NonNullable<UpgradeReport['packages']>['install'];
      if (after !== undefined) {
        installed = 'needed';
        if (write) {
          await fs.writeFile(path.join(root, 'package.json'), after);
          if (local.length > 0) {
            installed = 'skipped';
          } else if (options.install !== false && !options.json) {
            installed = (await install(manager, root)) ? 'done' : 'failed';
          }
        }
      }

      // Recorded even when nothing changed: a project from before scripts were kept learns which are still the CLI's.
      if (write) {
        await writeScaffoldRecord(root, CLI_VERSION, { scripts: recorded });
      }

      report.packages = { ...rest, local, ...(installed === undefined ? {} : { install: installed }) };
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

  console.log(options.json ? JSON.stringify(report) : reportText(report, installCommand(manager)));
  if (report.packages?.install === 'failed') {
    process.exitCode = 1;
    console.error(chalk.dim(`\`${installCommand(manager)}\` failed.`));
  }
};
