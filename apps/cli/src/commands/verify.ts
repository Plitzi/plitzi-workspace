import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { checkRoutes, reportText, staticPaths } from './check';
import { projectHere } from './existingProject';

import type { CheckReport } from './check';
import type { ExistingProject } from './existingProject';

/**
 * `plitzi verify`: whether the project is left passing, in one command — the space authors with no warning, its source
 * and code lint clean, the types hold, the files are formatted, and every page that takes no parameter is whole in the
 * browser. Each step is the project's own script, run as its package manager runs one; only what fails is printed, and
 * a page that could not be looked at is said as not checked, never as passing.
 *
 *   plitzi verify
 *   plitzi verify --no-pages     # the pages left out, said as such
 */

export interface VerifyOptions {
  /** Commander's `--no-pages`: false when the pages are to be left out. */
  pages?: boolean;
  json?: boolean;
}

interface Step {
  name: string;
  command: string;
  /** Output that fails a step its exit code passes: a warning `author` prints and carries on after. */
  failsOn?: RegExp;
  /** What makes it pass, when that is one command. */
  fix?: string;
}

export interface StepResult {
  name: string;
  ok: boolean;
  /** What it said, its last lines: only for a step that failed. */
  said?: string[];
  fix?: string;
}

const TAIL = 15;

const WIDTHS = [1440, 390];

/** The steps the project has a script for, in the order a problem is best fixed in. */
export const stepsOf = (scripts: Record<string, string>): Step[] => [
  ...(scripts.author ? [{ name: 'author', command: scripts.author, failsOn: /^\[author\] /m }] : []),
  ...(scripts['lint:space'] ? [{ name: 'lint:space', command: scripts['lint:space'] }] : []),
  ...(scripts.typecheck ? [{ name: 'typecheck', command: scripts.typecheck }] : []),
  ...(scripts.lint ? [{ name: 'lint', command: scripts.lint }] : []),
  // `format` writes; whether there is anything to write is asked of the same formatter without it.
  ...(Object.hasOwn(scripts, 'format') && scripts.format.startsWith('prettier')
    ? [{ name: 'format', command: 'prettier --check .', fix: 'the format script writes them' }]
    : [])
];

/** A script run the way a package manager runs one: in the project, with its installed binaries first on the path. */
const run = (root: string, command: string): Promise<{ code: number; output: string }> =>
  new Promise(resolve => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`
      }
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', error => resolve({ code: 1, output: error.message }));
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });

/** A step's output, as much as says why it failed: its last lines that hold anything. */
const tail = (output: string): string[] =>
  output
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
    .slice(-TAIL);

const scriptsOf = async (root: string): Promise<Record<string, string>> => {
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
  const scripts = isRecord(parsed) && isRecord(parsed.scripts) ? parsed.scripts : {};

  return Object.fromEntries(
    Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
};

/** A page the browser was sent away from, or that nothing answered: not looked at, so neither passing nor failing. */
const unchecked = (report: CheckReport): boolean =>
  report.issues.some(issue => issue.code === 'redirected' || issue.code === 'no-answer');

export const verify = async (options: VerifyOptions): Promise<void> => {
  const project = await projectHere('to verify');
  if (!project) {
    return;
  }

  const results: StepResult[] = [];
  for (const step of stepsOf(await scriptsOf(project.root))) {
    const { code, output } = await run(project.root, step.command);
    const ok = code === 0 && !step.failsOn?.test(output);
    results.push({
      name: step.name,
      ok,
      ...(ok ? {} : { said: tail(output), ...(step.fix ? { fix: step.fix } : {}) })
    });
  }

  const pages = options.pages === false ? undefined : await pagesChecked(project);
  const failed =
    results.some(result => !result.ok) || pages === undefined || 'problem' in pages || pages.failing.length > 0;

  if (options.json) {
    console.log(JSON.stringify({ ok: !failed, steps: results, pages: pages ?? { left: true } }));
  } else {
    console.log(verifyText(results, pages));
  }

  if (failed) {
    process.exitCode = 1;
  }
};

interface PagesChecked {
  passing: number;
  failing: CheckReport[];
  /** Pages a browser could not look at — one for signed-in visitors, sent to sign in: by path. */
  unchecked: string[];
}

const pagesChecked = async (project: ExistingProject): Promise<PagesChecked | { problem: string }> => {
  const paths = await staticPaths(project.root);
  if ('problem' in paths) {
    return paths;
  }

  const reports = await checkRoutes(project, paths, { widths: WIDTHS, asked: { state: false }, ssr: false });
  if ('problem' in reports) {
    return { problem: `${reports.problem} — start it (npm start) and verify again, or --no-pages to leave them` };
  }

  return {
    passing: reports.filter(report => report.ok).length,
    failing: reports.filter(report => !report.ok && !unchecked(report)),
    unchecked: [...new Set(reports.filter(unchecked).map(report => report.path))]
  };
};

export const verifyText = (
  results: readonly StepResult[],
  pages: PagesChecked | { problem: string } | undefined
): string =>
  [
    ...results.flatMap(result =>
      result.ok
        ? [chalk.green(`✓ ${result.name}`)]
        : [
            chalk.red(`✗ ${result.name}`),
            ...(result.said ?? []).map(line => `    ${line}`),
            ...(result.fix ? [`    → ${result.fix}`] : [])
          ]
    ),
    ...(pages === undefined
      ? [chalk.yellow('- pages not checked: --no-pages')]
      : 'problem' in pages
        ? [chalk.red(`✗ pages — ${pages.problem}`)]
        : [
            pages.failing.length === 0
              ? chalk.green(`✓ pages — ${String(pages.passing)} checks at ${WIDTHS.join(' and ')} px`)
              : chalk.red(
                  `✗ pages — ${String(pages.failing.length)} of ${String(pages.passing + pages.failing.length)} checks`
                ),
            ...pages.failing.map(report => reportText(report, { state: false })),
            ...(pages.unchecked.length > 0
              ? [
                  chalk.yellow(
                    `- not checked — sent elsewhere (a page for signed-in visitors) or not answered: ${pages.unchecked.join(', ')} — plitzi page check <path> --as <username>`
                  )
                ]
              : [])
          ])
  ].join('\n');
