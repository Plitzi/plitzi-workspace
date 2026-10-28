import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { projectHere } from './existingProject';
import { USAGE_OFF } from '../../runs/core/usage';
import { projectRun } from '../../scaffold/packageManager';
import { checkAccount, checkRoutes, CHECK_PASSWORD_ENV, CHECK_USER_ENV, reportText, staticPaths } from '../page/check';

import type { ExistingProject } from './existingProject';
import type { Scheme } from '../../browser';
import type { Account, CheckReport } from '../page/check';

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
  /** Every step, even after one failed: by default the first failure ends the run, the rest said as not run. */
  keepGoing?: boolean;
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

/** Of what a failing line says under it, the deepest lines kept: where a type error says its cause. */
const CAUSE_LINES = 3;

const WIDTHS = [1440, 390];

/** The steps the project has a script for, in the order a problem is best fixed in. */
export const stepsOf = (scripts: Record<string, string>): Step[] => [
  ...(scripts.author ? [{ name: 'author', command: scripts.author, failsOn: /^\[author\] /m }] : []),
  ...(scripts['lint:space'] ? [{ name: 'lint:space', command: scripts['lint:space'] }] : []),
  ...(scripts.typecheck ? [{ name: 'typecheck', command: scripts.typecheck }] : []),
  ...(scripts.lint ? [{ name: 'lint', command: scripts.lint }] : []),
  // The project's own tests — a plugin's rules, a runtime's routes — which no other step reads.
  ...(scripts.test ? [{ name: 'test', command: scripts.test }] : []),
  // `format` writes; whether there is anything to write is asked of the same formatter without it.
  ...(Object.hasOwn(scripts, 'format') && scripts.format.startsWith('prettier')
    ? [{ name: 'format', command: 'prettier --check .', fix: 'the format script writes them' }]
    : [])
];

/**
 * A script run the way a package manager runs one: in `cwd`, with the binaries installed in `binRoot` first on the path —
 * the project's own, also for a copy of it that has no `node_modules` of its own (a run's task).
 */
export const runScript = (
  cwd: string,
  command: string,
  binRoot: string = cwd,
  { env = {}, bin = [] }: { env?: Record<string, string>; bin?: readonly string[] } = {}
): Promise<{ code: number; output: string }> =>
  new Promise(resolve => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        ...env,
        // What it prints is read by this command, not by an agent: a `plitzi` it runs counts no usage of its own.
        [USAGE_OFF]: '1',
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        PATH: [...bin, path.join(binRoot, 'node_modules', '.bin'), process.env.PATH ?? ''].join(path.delimiter)
      }
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', error => resolve({ code: 1, output: error.message }));
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });

/**
 * A line that says what failed: a check's `✗` and its `- ` findings, a test's `FAIL`/`×` — node's `✖`, TAP's `not ok` —
 * a compiler's `error`. A tester read the tail of node's error object, never the name of the test that failed.
 */
const FAILING = /^\s*(✗|✘|✖|×|- |FAIL\b|not ok\b)|\berror\b|Error:/;

/**
 * A line a script prints that says nothing of what failed: a copy's missing `.env`, expected (runs.md) — every failed
 * a run's `author` began with it, and a run's t-predictions went to review failing "the same way without
 * this task: .env not found".
 */
export const isNotice = (line: string): boolean => /\.env not found|Continuing without it/.test(line);

/**
 * A step's output, as much as says why it failed: its lines that hold anything, the last `TAIL` of them — and, cut, the
 * ones that say what failed first, in their place. A page check says its failure above what it read (`·` lines): its
 * last lines alone were what passed (`✓ / at 390 px`), and the failure at 1440 was cut.
 */
export const tail = (output: string): string[] => {
  const lines = output
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '' && !isNotice(line));
  if (lines.length <= TAIL) {
    return lines;
  }

  // A failing line and what it says under it, indented — tsc names an overload, then, deepest, its cause: kept with its
  // deepest lines, where the cause is (a run's tester read the overloads and lost `T | Promise<T>`).
  const indent = (line: string): number => line.length - line.trimStart().length;
  const blocks = lines.flatMap((line, index) => {
    if (!FAILING.test(line)) {
      return [];
    }

    let end = index;
    while (end + 1 < lines.length && indent(lines[end + 1]) > indent(line) && !FAILING.test(lines[end + 1])) {
      end += 1;
    }

    // The deepest lines under it: tsc's cause is said last and indented most.
    const under = Array.from({ length: end - index }, (_, offset) => index + 1 + offset)
      .sort((a, b) => indent(lines[b]) - indent(lines[a]) || b - a)
      .slice(0, CAUSE_LINES)
      .sort((a, b) => a - b);

    return [index, ...under];
  });
  const kept = new Set(blocks.slice(0, TAIL));
  for (let index = lines.length - 1; index >= 0 && kept.size < TAIL; index -= 1) {
    kept.add(index);
  }

  return [...kept].sort((a, b) => a - b).map(index => lines[index]);
};

/** The banner Node prints under the stack of an error nothing caught, as its last line: what failed is above it. */
const NODE_CRASH = /^Node\.js v\d+/;
const THROWN = /^\s*(?:\[\w+\]: )?\w*Error(?: \[[\w-]+\])?: /;

/**
 * Why an output failed, in one line: its last that says a failure, else its last — and under a process Node ended on an
 * uncaught error, the error, never the version banner it ends with (a run's lines read "the first failed: Node.js
 * v24.22.1").
 */
export const failedWhy = (lines: readonly string[] | undefined): string | undefined => {
  const said = (lines ?? []).filter(line => line.trim() !== '');
  const last = said.at(-1);
  if (last === undefined || !NODE_CRASH.test(last.trim())) {
    // The last that says what failed — a test runner ends on its count ("3 passed (9.1m)", a run's), not on it.
    return said.findLast(line => FAILING.test(line))?.trim() ?? last;
  }

  return said.find(line => THROWN.test(line))?.trim() ?? said.filter(line => !NODE_CRASH.test(line.trim())).at(-1);
};

export const scriptsOf = async (root: string): Promise<Record<string, string>> => {
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
  const scripts = isRecord(parsed) && isRecord(parsed.scripts) ? parsed.scripts : {};

  return Object.fromEntries(
    Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
};

/** A page the browser was sent away from — one for signed-in visitors, sent to sign in. */
const redirected = (report: CheckReport): boolean => report.issues.some(issue => issue.code === 'redirected');

const unanswered = (report: CheckReport): boolean => report.issues.some(issue => issue.code === 'no-answer');

/** A page the browser was sent away from, or that nothing answered: not looked at, so neither passing nor failing. */
const unchecked = (report: CheckReport): boolean => redirected(report) || unanswered(report);

export const verify = async (options: VerifyOptions): Promise<void> => {
  const project = await projectHere('to verify');
  if (!project) {
    return;
  }

  const results: StepResult[] = [];
  const steps = stepsOf(await scriptsOf(project.root));
  const waiting: string[] = [];
  for (const [index, step] of steps.entries()) {
    const { code, output } = await runScript(project.root, step.command);
    const ok = code === 0 && !step.failsOn?.test(output);
    // A fix offered only for what it fixes: a file the formatter cannot read is not one it would write.
    const fixes = step.fix !== undefined && !/\[error\]/.test(output);
    results.push({ name: step.name, ok, ...(ok ? {} : { said: tail(output), ...(fixes ? { fix: step.fix } : {}) }) });
    // One broken file fails every step after it the same way: the first is the one to fix, the rest run once it passes.
    if (!ok && !options.keepGoing) {
      waiting.push(...steps.slice(index + 1).map(each => each.name), ...(options.pages === false ? [] : ['pages']));
      break;
    }
  }

  const pages = options.pages === false || waiting.length > 0 ? undefined : await pagesChecked(project);
  const failed =
    results.some(result => !result.ok) || (pages !== undefined && ('problem' in pages || pages.failing.length > 0));

  if (options.json) {
    console.log(
      JSON.stringify({
        ok: !failed,
        steps: results,
        ...(waiting.length > 0 ? { notRun: waiting } : {}),
        pages: pages ?? { left: true }
      })
    );
  } else {
    console.log(verifyText(results, waiting.length > 0 ? { waiting, after: results.at(-1)?.name ?? '' } : pages));
  }

  if (failed) {
    process.exitCode = 1;
  }
};

interface PagesChecked {
  /** The themes every page was checked in: each the space can be painted in — dark too, unless it says light only. */
  schemes: Scheme[];
  passing: number;
  failing: CheckReport[];
  /** Pages that sent the browser away — one for signed-in visitors, sent to sign in: by path. */
  unchecked: string[];
  /** Pages nothing answered at, while others did: by path. */
  unanswered: string[];
  /**
   * The pages that sent the browser to sign in, checked again signed in as the project's account — or why they could
   * not be. Absent when no page did.
   */
  signedIn?: { as: string; checks: number } | { problem: string } | { none: true };
}

const NOT_STARTED = `start it (${projectRun('start')}) and verify again, or --no-pages to leave them`;

/**
 * Nothing answered any page: the project is not served — never a page for signed-in visitors. A new project, its server
 * not started, was told to name an account in .env.
 */
export const unservedProblem = (reports: readonly CheckReport[]): string | undefined => {
  const silent = reports.find(unanswered)?.issues.find(issue => issue.code === 'no-answer');

  return silent && reports.every(unanswered) ? `${silent.message} — ${NOT_STARTED}` : undefined;
};

const pagesChecked = async (project: ExistingProject): Promise<PagesChecked | { problem: string }> => {
  const found = await staticPaths(project.root);
  if ('problem' in found) {
    return found;
  }

  const { paths, schemes } = found;
  // Every theme the space can be painted in: a colour fixed for the light one is unreadable in the dark one, and a
  // visitor whose system is dark sees that one.
  const inEveryTheme = async (routes: string[], account?: Account): Promise<CheckReport[] | { problem: string }> => {
    const all: CheckReport[] = [];
    for (const scheme of schemes) {
      const reports = await checkRoutes(project, routes, {
        widths: WIDTHS,
        asked: { state: false, elements: [] },
        ssr: false,
        scheme,
        ...(account ? { account } : {})
      });
      // The problem names its own fix — start the project, install Chromium: what is verify's to add is the rest.
      if ('problem' in reports) {
        return { problem: `${reports.problem} — then verify again, or --no-pages to leave them` };
      }

      all.push(...reports);
    }

    return all;
  };

  const reports = await inEveryTheme(paths);
  if ('problem' in reports) {
    return reports;
  }

  const unserved = unservedProblem(reports);
  if (unserved) {
    return { problem: unserved };
  }

  const sentAway = [...new Set(reports.filter(redirected).map(report => report.path))];
  if (sentAway.length === 0) {
    return summary(schemes, reports);
  }

  const account = await checkAccount(project.root);
  if (!account || 'problem' in account) {
    return summary(schemes, reports, account ?? { none: true });
  }

  const signedIn = await inEveryTheme(sentAway, account);
  if ('problem' in signedIn) {
    return signedIn;
  }

  return summary(schemes, [...reports.filter(report => !sentAway.includes(report.path)), ...signedIn], {
    as: account.username,
    checks: signedIn.filter(report => !unchecked(report)).length
  });
};

const summary = (
  schemes: Scheme[],
  reports: readonly CheckReport[],
  signedIn?: PagesChecked['signedIn']
): PagesChecked => ({
  schemes,
  passing: reports.filter(report => report.ok).length,
  failing: reports.filter(report => !report.ok && !unchecked(report)),
  unchecked: [...new Set(reports.filter(redirected).map(report => report.path))],
  unanswered: [
    ...new Set(reports.filter(report => unanswered(report) && !redirected(report)).map(report => report.path))
  ],
  ...(signedIn ? { signedIn } : {})
});

/** Why the pages left are not checked, and what checks them. */
const uncheckedText = (pages: PagesChecked): string => {
  const list = pages.unchecked.join(', ');
  const signedIn = pages.signedIn;
  if (!signedIn || 'none' in signedIn) {
    return `- not checked — sent elsewhere (a page for signed-in visitors): ${list} — name an account of the project in .env, ${CHECK_USER_ENV} and ${CHECK_PASSWORD_ENV}, and verify signs in for them`;
  }

  if ('problem' in signedIn) {
    return `- not checked — sent elsewhere (a page for signed-in visitors): ${list} — ${signedIn.problem}`;
  }

  return `- not checked, even signed in as ${signedIn.as}: ${list} — that account may not see them, or nothing answered`;
};

export const verifyText = (
  results: readonly StepResult[],
  pages: PagesChecked | { problem: string } | { waiting: string[]; after: string } | undefined
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
      : 'waiting' in pages
        ? [
            chalk.yellow(
              `- not run until ${pages.after} passes: ${pages.waiting.join(', ')} (--keep-going runs them anyway)`
            )
          ]
        : 'problem' in pages
          ? [chalk.red(`✗ pages — ${pages.problem}`)]
          : [
              pages.failing.length === 0
                ? chalk.green(
                    `✓ pages — ${String(pages.passing)} checks at ${WIDTHS.join(' and ')} px, ${pages.schemes.join(' and ')}${pages.signedIn && 'as' in pages.signedIn ? `, ${String(pages.signedIn.checks)} of them signed in as ${pages.signedIn.as}` : ''}`
                  )
                : chalk.red(
                    `✗ pages — ${String(pages.failing.length)} of ${String(pages.passing + pages.failing.length)} checks`
                  ),
              ...pages.failing.map(report => reportText(report, { state: false, elements: [] })),
              ...(pages.unchecked.length > 0 ? [chalk.yellow(uncheckedText(pages))] : []),
              ...(pages.unanswered.length > 0
                ? [chalk.yellow(`- not checked — nothing answered: ${pages.unanswered.join(', ')}`)]
                : [])
            ])
  ].join('\n');
