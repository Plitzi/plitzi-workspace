import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { checkConfig } from './config';
import { checkData } from './data';
import { checkFunctions } from './functions';
import { checkLayout } from './layout';
import { checkMachinery } from './machinery';
import { checkPackages } from './packages';
import { checkPlugins } from './plugins';
import { checkRecords, checkSkills } from './records';
import { checkSources } from './sources';
import { DOCTOR_AREAS, sayer } from './types';
import { lockfileManager, projectHere } from '../commands/existingProject';
import { readScaffoldRecord } from '../commands/scaffoldRecord';
import { readOrigin } from '../commands/spaceOrigin';
import { fail } from '../commands/terminal';
import { answersFor } from '../commands/upgrade';
import { CLI_VERSION } from '../scaffold/project';

import type { Check, DoctorArea, DoctorContext, Finding, Repair, Severity } from './types';

export type { DoctorArea, Finding, Severity } from './types';

/**
 * `plitzi doctor`: whether the project is whole as the CLI sets it up — everything a developer may have changed checked
 * against what makes it install, start, build and push, rather than against what the CLI once wrote. The space itself
 * — what it authors to, and what it warns of — is `npm run author`'s and `plitzi check`'s, never the doctor's.
 *
 * Each problem says where it is and what fixes it. Nothing is changed unless `--fix` says so, and then only what is
 * simple and safe — a layout an older CLI left, dead files, `.gitignore`, a folder a script watches, a missing secret —
 * examined again after; what is `upgrade`'s or the install's to do is recommended, never done. A project of an older
 * CLI is the usual patient: `npx @plitzi/cli@latest doctor --fix`, then what it recommends.
 *
 * Exit code 1 when anything is an error — with `--strict`, a warning too — so a CI step or a pre-commit hook can run it.
 *
 *   plitzi doctor
 *   plitzi doctor --fix --dry-run
 *   plitzi doctor --json --strict
 */

export interface DoctorOptions {
  json?: boolean;
  /** Warnings fail too: for a CI that keeps the project up to its CLI. */
  strict?: boolean;
  /** Repair what is simple and safe to, then examine again. */
  fix?: boolean;
  /** With `--fix`: say what it would repair, and repair nothing. */
  dryRun?: boolean;
}

/**
 * What the doctor does not check, and what does — said in every report, so nobody takes a healthy project for a space
 * without problems: the space is authoring's, how it is written lint's, a page the browser's.
 */
export const NOT_CHECKED = [
  { what: 'the space — what it authors to, refuses and warns of', by: 'npm run author' },
  { what: 'how the space is written — its files, data, tokens, repeats', by: 'plitzi lint' },
  { what: 'a page as it renders', by: 'plitzi check' }
] as const;

/** A finding as it is reported: its repair said, not run. */
export type ReportedFinding = Omit<Finding, 'repair'> & { repair?: string };

/** What fixes most of what is left, by the command: the next thing to run. */
export interface Recommendation {
  command: string;
  fixes: number;
}

export type AreaStatus = 'ok' | 'warning' | 'error' | 'skipped';

export interface DoctorReport {
  cli: string;
  /** Always the project as the CLI sets it up — never the space (`notChecked`). */
  scope: 'project';
  notChecked: typeof NOT_CHECKED;
  project: { root: string; name: string; mode: 'server' | 'client'; source: 'local' | 'cloud'; space?: string };
  ok: boolean;
  strict: boolean;
  counts: Record<Severity, number>;
  areas: { area: DoctorArea; status: AreaStatus }[];
  findings: ReportedFinding[];
  /** What `--fix` repaired before this report was made — or, with `--dry-run`, would have. */
  repaired: { done: boolean; repairs: string[]; failed: { repair: string; error: string }[] };
  recommendations: Recommendation[];
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** A check that could not finish is said as what it is — never a doctor that crashes on the project it examines. */
const guarded = async (area: DoctorArea, run: () => Promise<Finding[]>): Promise<Finding[]> => {
  try {
    return await run();
  } catch (error) {
    return [
      sayer(area).error(
        'check-failed',
        `The ${area} check could not finish: ${error instanceof Error ? error.message : String(error)}`
      )
    ];
  }
};

const CHECKS: readonly [DoctorArea, Check][] = [
  ['packages', checkPackages],
  ['machinery', checkMachinery],
  ['config', checkConfig],
  ['sources', checkSources],
  ['plugins', checkPlugins],
  ['data', checkData],
  ['functions', checkFunctions],
  ['records', checkRecords],
  ['skills', checkSkills]
];

/**
 * Every area checked, in the order they are said. A layout an older CLI left, where the commands would not find the
 * project's parts, is examined alone: read against it, every other area would only say what moving it fixes. Any other
 * error of the layout — a plugin with no entry, code in a misnamed folder — is one problem among the rest.
 */
export const examine = async (context: DoctorContext): Promise<{ findings: Finding[]; skipped: boolean }> => {
  const layout = await guarded('layout', () => checkLayout(context));
  const skipped = layout.some(finding => finding.code === 'older-layout');
  const findings = [...layout];
  for (const [area, check] of skipped ? [] : CHECKS) {
    findings.push(...(await guarded(area, () => check(context))));
  }

  return {
    findings: findings.sort(
      (a, b) =>
        DOCTOR_AREAS.indexOf(a.area) - DOCTOR_AREAS.indexOf(b.area) ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    ),
    skipped
  };
};

const COMMAND = /^(?:plitzi|npx|npm|yarn|pnpm|git)\s/;

/** The command a fix starts with — `plitzi upgrade files --write` of "plitzi upgrade files --write (it records …)". */
const commandOf = (fix: string | undefined): string | undefined => {
  const first = fix?.split(/\s[—(]|;|,\s|\s+then\s/)[0].trim();

  return first && COMMAND.test(first) ? first : undefined;
};

/**
 * What to run next, by how many problems each command fixes — `upgrade`'s parts counted as one `upgrade --write`, and
 * what `--fix` repairs as `doctor --fix`: the few commands that clear most of the list.
 */
const recommendationsOf = (findings: readonly Finding[], fixed: boolean): Recommendation[] => {
  const counts = new Map<string, number>();
  for (const finding of findings.filter(each => each.severity !== 'info')) {
    const command = finding.repair && !fixed ? 'plitzi doctor --fix' : commandOf(finding.fix);
    if (!command) {
      continue;
    }

    const key = command.startsWith('plitzi upgrade') ? 'plitzi upgrade --write' : command;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts]
    .map(([command, fixes]) => ({ command, fixes }))
    .sort((a, b) => b.fixes - a.fixes || a.command.localeCompare(b.command));
};

export const reportOf = (
  context: DoctorContext,
  { findings, skipped }: { findings: Finding[]; skipped: boolean },
  { strict, repaired, fixed }: { strict: boolean; repaired: DoctorReport['repaired']; fixed: boolean }
): DoctorReport => {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach(finding => {
    counts[finding.severity]++;
  });
  const areas = DOCTOR_AREAS.map(area => {
    const of = findings.filter(finding => finding.area === area);
    let status: AreaStatus = 'ok';
    if (of.some(finding => finding.severity === 'error')) {
      status = 'error';
    } else if (of.some(finding => finding.severity === 'warning')) {
      status = 'warning';
    } else if (skipped && area !== 'layout') {
      status = 'skipped';
    }

    return { area, status };
  });

  return {
    cli: CLI_VERSION,
    scope: 'project',
    notChecked: NOT_CHECKED,
    project: {
      root: context.root,
      name: context.answers.name,
      mode: context.answers.mode,
      source: context.answers.source,
      ...(context.origin ? { space: context.origin.space.name } : {})
    },
    ok: counts.error === 0 && (!strict || counts.warning === 0),
    strict,
    counts,
    areas,
    findings: findings.map(({ repair, ...finding }) => ({ ...finding, ...(repair ? { repair: repair.says } : {}) })),
    repaired,
    recommendations: recommendationsOf(findings, fixed)
  };
};

const MARK: Record<Severity | 'ok' | 'skipped', string> = {
  ok: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('!'),
  info: chalk.dim('·'),
  skipped: chalk.dim('–')
};

const plural = (count: number, word: string): string => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

const repairedText = (repaired: DoctorReport['repaired']): string[] => {
  if (repaired.repairs.length === 0 && repaired.failed.length === 0) {
    return [];
  }

  return [
    repaired.done ? chalk.green('Repaired:') : chalk.yellow('--fix would repair (--dry-run: nothing done):'),
    ...repaired.repairs.map(each => `    ${chalk.green('+')} ${each}`),
    ...repaired.failed.map(({ repair, error }) => `    ${chalk.red('✗')} ${repair}: ${error}`),
    ''
  ];
};

export const reportText = (report: DoctorReport): string => {
  const { project } = report;
  // Laid out as an older CLI did, what the project is cannot be told yet: where its space is, least of all.
  const older = report.areas.some(({ status }) => status === 'skipped');
  const where = project.source === 'local' ? 'the space in src/space' : 'the space on Plitzi';
  const lines = [
    chalk.bold(
      `plitzi doctor — ${project.name} (${project.mode}, ${older ? 'laid out by an older CLI' : where}${project.space ? `, from ${project.space}` : ''})`
    ),
    ...repairedText(report.repaired)
  ];
  for (const { area, status } of report.areas) {
    lines.push(
      status === 'skipped'
        ? chalk.dim(`${MARK.skipped} ${area} — checked once the layout is this CLI's`)
        : `${MARK[status]} ${area}`
    );
    for (const finding of report.findings.filter(each => each.area === area)) {
      const text = `    ${MARK[finding.severity]} ${finding.message}`;
      lines.push(finding.severity === 'info' ? chalk.dim(text) : text);
      if (finding.fix && finding.severity !== 'info') {
        lines.push(chalk.dim(`      → ${finding.fix}${finding.repair ? ' (doctor --fix does it)' : ''}`));
      }
    }
  }

  const { error, warning, info } = report.counts;
  const summary = [
    plural(error, 'error'),
    plural(warning, 'warning'),
    ...(info > 0 ? [`${String(info)} noted`] : [])
  ].join(', ');
  lines.push('');
  if (report.recommendations.length > 0) {
    lines.push(
      chalk.bold('Next:'),
      ...report.recommendations.map(
        ({ command, fixes }) => `    ${command}${chalk.dim(` — ${plural(fixes, 'problem')} of these`)}`
      ),
      ''
    );
  }

  lines.push(
    chalk.dim(`Not checked here: ${report.notChecked.map(({ what, by }) => `${what} (\`${by}\`)`).join('; ')}.`),
    report.ok
      ? chalk.green(`Healthy — ${summary}.`)
      : chalk.red(`${summary}${report.strict && error === 0 ? ' (--strict: warnings fail too)' : ''}.`)
  );

  return lines.join('\n');
};

/** The project as every check reads it, or a reason there is none to check. */
const contextOf = async (): Promise<DoctorContext | undefined> => {
  const project = await projectHere('to check');
  if (!project) {
    return undefined;
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(project.root, 'package.json'), 'utf-8'));
  } catch (error) {
    fail(`package.json is not JSON: ${error instanceof Error ? error.message : String(error)}`);

    return undefined;
  }

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  if (!plitzi || !isRecord(manifest)) {
    fail(
      'plitzi doctor checks a project plitzi create wrote — one that depends on @plitzi/plitzi-sdk and starts at src/main.ts — and this is not one.'
    );

    return undefined;
  }

  // As the files it finds are named: a temporary folder behind a link (`/var` → `/private/var`) is named by where it is.
  const root = await fs.realpath(project.root);
  const record = await readScaffoldRecord(root);
  // As `upgrade` reads it: what the project installs with now, then what the CLI wrote it for.
  const manager = (await lockfileManager([root])) ?? record?.packageManager ?? project.packageManager ?? 'npm';
  const origin = await readOrigin(root);

  return {
    root,
    project: plitzi,
    answers: await answersFor(root, plitzi, manager, origin !== undefined),
    manifest,
    manager,
    origin,
    record
  };
};

/** Each repair once, though several findings name it (a layout moved at once). */
const repairsOf = (findings: readonly Finding[]): Repair[] => [
  ...new Set(findings.flatMap(finding => (finding.repair ? [finding.repair] : [])))
];

/** Rounds of `--fix`: a repair can uncover the next (the layout moved, the areas it held back are read). */
const MAX_ROUNDS = 3;

export const doctor = async (options: DoctorOptions): Promise<void> => {
  let context = await contextOf();
  if (!context) {
    return;
  }

  let examined = await examine(context);
  const repaired: DoctorReport['repaired'] = { done: !options.dryRun, repairs: [], failed: [] };
  for (let round = 0; options.fix && round < MAX_ROUNDS; round++) {
    const repairs = repairsOf(examined.findings);
    if (repairs.length === 0) {
      break;
    }

    if (options.dryRun) {
      repaired.repairs.push(...repairs.map(repair => repair.says));
      break;
    }

    for (const repair of repairs) {
      try {
        await repair.run();
        repaired.repairs.push(repair.says);
      } catch (error) {
        repaired.failed.push({ repair: repair.says, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Read again from the start: what the project is may be what a repair changed (its layout, its package.json).
    const next = await contextOf();
    if (!next) {
      return;
    }

    context = next;
    examined = await examine(context);
    if (repaired.failed.length > 0) {
      break;
    }
  }

  const report = reportOf(context, examined, {
    strict: Boolean(options.strict),
    repaired,
    fixed: Boolean(options.fix) && !options.dryRun
  });
  console.log(options.json ? JSON.stringify(report) : reportText(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
};
