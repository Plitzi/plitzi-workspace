import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { checkConfig } from './config';
import { checkData } from './data';
import { checkFunctions } from './functions';
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

import type { Check, DoctorArea, DoctorContext, Finding, Severity } from './types';

export type { DoctorArea, Finding, Severity } from './types';

/**
 * `plitzi doctor`: whether the project is whole as the CLI sets it up — everything a developer may have changed checked
 * against what makes it install, start, build and push, rather than against what the CLI once wrote. The space itself
 * — what it authors to, and what it warns of — is `npm run author`'s and `plitzi check`'s, never the doctor's. Each
 * problem says where it is and what fixes it; nothing is changed (`plitzi upgrade --write` and the fixes named do that).
 *
 * Exit code 1 when anything is an error — with `--strict`, a warning too — so a CI step or a pre-commit hook can run it.
 *
 *   plitzi doctor
 *   plitzi doctor --json
 *   plitzi doctor --strict
 */

export interface DoctorOptions {
  json?: boolean;
  /** Warnings fail too: for a CI that keeps the project up to its CLI. */
  strict?: boolean;
}

/**
 * What the doctor does not check, and what does — said in every report, so nobody takes a healthy project for a space
 * without problems: the space is authoring's, a page the browser's.
 */
export const NOT_CHECKED = [
  { what: 'the space: what it authors to, refuses and warns of', by: 'npm run author' },
  { what: 'a page as it renders: on screen, overflow, console, flows', by: 'plitzi check' }
] as const;

export interface DoctorReport {
  cli: string;
  /** Always the project as the CLI sets it up — never the space (`notChecked`). */
  scope: 'project';
  notChecked: typeof NOT_CHECKED;
  project: { root: string; name: string; mode: 'server' | 'client'; source: 'local' | 'cloud'; space?: string };
  ok: boolean;
  strict: boolean;
  counts: Record<Severity, number>;
  areas: { area: DoctorArea; status: 'ok' | 'warning' | 'error' }[];
  findings: Finding[];
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

/** Every area checked, in the order they are said. */
export const examine = async (context: DoctorContext): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const [area, check] of CHECKS) {
    findings.push(...(await guarded(area, () => check(context))));
  }

  return findings.sort(
    (a, b) =>
      DOCTOR_AREAS.indexOf(a.area) - DOCTOR_AREAS.indexOf(b.area) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
};

export const reportOf = (context: DoctorContext, findings: Finding[], strict: boolean): DoctorReport => {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach(finding => {
    counts[finding.severity]++;
  });
  const areas = DOCTOR_AREAS.map(area => {
    const of = findings.filter(finding => finding.area === area);
    const status: 'ok' | 'warning' | 'error' = of.some(finding => finding.severity === 'error')
      ? 'error'
      : of.some(finding => finding.severity === 'warning')
        ? 'warning'
        : 'ok';

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
    findings
  };
};

const MARK: Record<Severity | 'ok', string> = {
  ok: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('!'),
  info: chalk.dim('·')
};

const plural = (count: number, word: string): string => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

export const reportText = (report: DoctorReport): string => {
  const { project } = report;
  const lines = [
    chalk.bold(
      `plitzi doctor — ${project.name} (${project.mode}, ${project.source === 'local' ? 'the space in src/space' : 'the space on Plitzi'}${project.space ? `, from ${project.space}` : ''})`
    )
  ];
  for (const { area, status } of report.areas) {
    lines.push(`${MARK[status]} ${area}`);
    for (const finding of report.findings.filter(each => each.area === area)) {
      const text = `    ${MARK[finding.severity]} ${finding.message}`;
      lines.push(finding.severity === 'info' ? chalk.dim(text) : text);
      if (finding.fix && finding.severity !== 'info') {
        lines.push(chalk.dim(`      → ${finding.fix}`));
      }
    }
  }

  const { error, warning, info } = report.counts;
  const summary = [
    plural(error, 'error'),
    plural(warning, 'warning'),
    ...(info > 0 ? [`${String(info)} noted`] : [])
  ].join(', ');
  lines.push(
    '',
    chalk.dim(
      `The project as the CLI sets it up — not the space: ${report.notChecked.map(({ what, by }) => `${what} is \`${by}\`'s`).join('; ')}.`
    ),
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

export const doctor = async (options: DoctorOptions): Promise<void> => {
  const context = await contextOf();
  if (!context) {
    return;
  }

  const report = reportOf(context, await examine(context), Boolean(options.strict));
  console.log(options.json ? JSON.stringify(report) : reportText(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
};
