import { execFile } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { authorSpace, refusalOf } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { loadProjectSpace } from './projectSpace';
import { effectLines, isReadings, readingOf, spaceEffects } from './spaceReading';
import { fail } from './terminal';
import { locatedSpace } from './where';
import { spaceFindings, spaceProject } from '../lint';
import { DATA_DIR, PLUGINS_DIR, PUBLIC_DIR, SPACE_DIR } from '../scaffold/paths';

import type { ElementReading } from './spaceReading';
import type { LintFinding } from '../lint';

/**
 * `plitzi space watch`: the space read again every time a file of it is saved, and only what changed said — what the
 * save did to the space element by element, the problems it brought and the ones it fixed, or that the space stopped
 * authoring and why. What an agent runs in the background beside its edits, so it hears of what each one did without
 * asking: `--json` says each event as one line.
 *
 * Each pass reads the space in a process of its own: this one would answer with the modules it loaded first.
 *
 * Not a page as it renders — the project's server restarts on the same save, and `plitzi page check` is what looks at
 * one — nor the project around the space: `plitzi doctor`.
 *
 *   plitzi space watch
 *   plitzi space watch --json
 */

export interface WatchOptions {
  json?: boolean;
}

/** A warning of the document's validator, as a pass carries it. */
export interface PassWarning {
  code: string;
  message: string;
  elementId?: string;
}

/** What one pass read: the space as it authors now, or why it does not. */
export type WatchPass =
  | { authors: true; findings: LintFinding[]; warnings: PassWarning[]; readings: ElementReading[] }
  | { authors: false; problem: string; findings: LintFinding[] };

/** What came and went between two passes. */
export interface Delta<T> {
  added: T[];
  resolved: T[];
}

/** What a watch says, one a line with `--json`. */
export type WatchEvent =
  | {
      type: 'ready';
      authors: boolean;
      problem?: string;
      elements?: number;
      findings: LintFinding[];
      warnings: PassWarning[];
      watching: string[];
    }
  | {
      type: 'pass';
      files: string[];
      ms: number;
      /** What the save did to the space, element by element — from the last pass that authored. */
      space: string[];
      findings: Delta<LintFinding>;
      warnings: Delta<PassWarning>;
      counts: { findings: number; warnings: number };
      /** Nothing the space is or says changed: a save that did nothing is said too. */
      unchanged?: true;
    }
  | { type: 'refused'; files: string[]; ms: number; problem: string; findings: Delta<LintFinding> }
  | { type: 'error'; files: string[]; problem: string };

/** As much of a refusal as says what broke: its head and its first problems. */
const REFUSAL_LINES = 12;

/** Saves this close together are one pass: an editor writes a file in steps, a formatter writes it again. */
const SETTLE_MS = 300;

/**
 * What a finding is, wherever it moved: an edit above it moves its line, and a finding that moved is neither fixed nor
 * new.
 */
const findingKey = ({ code, file, message }: LintFinding): string => `${code}\n${file ?? ''}\n${message}`;

const warningKey = ({ code, elementId, message }: PassWarning): string => `${code}\n${elementId ?? ''}\n${message}`;

const deltaOf = <T>(before: readonly T[], after: readonly T[], key: (item: T) => string): Delta<T> => {
  const was = new Set(before.map(key));
  const is = new Set(after.map(key));

  return { added: after.filter(item => !was.has(key(item))), resolved: before.filter(item => !is.has(key(item))) };
};

/**
 * What a save did, from the pass before it to the pass after: `last` is the last pass that authored, which the space's
 * changes are read against — after a refusal, the save that fixed it is said against the space before it broke.
 */
export const passEvent = (
  previous: WatchPass,
  last: Extract<WatchPass, { authors: true }> | undefined,
  current: WatchPass,
  files: string[],
  ms: number
): WatchEvent => {
  const findings = deltaOf(previous.findings, current.findings, findingKey);
  if (!current.authors) {
    return { type: 'refused', files, ms, problem: current.problem, findings };
  }

  const before = last?.readings ?? [];
  const space = last ? effectLines(spaceEffects(before, current.readings), before, current.readings) : [];
  const warnings = deltaOf(previous.authors ? previous.warnings : [], current.warnings, warningKey);
  const unchanged =
    previous.authors &&
    space.length === 0 &&
    findings.added.length + findings.resolved.length + warnings.added.length + warnings.resolved.length === 0;

  return {
    type: 'pass',
    files,
    ms,
    space,
    findings,
    warnings,
    counts: { findings: current.findings.length, warnings: current.warnings.length },
    ...(unchanged ? { unchanged: true as const } : {})
  };
};

const isPass = (value: unknown): value is WatchPass =>
  isRecord(value) &&
  Array.isArray(value.findings) &&
  (value.authors === false
    ? typeof value.problem === 'string'
    : value.authors === true && Array.isArray(value.warnings) && isReadings(value.readings));

const run = promisify(execFile);

/** One pass, read by a fresh process: this one loaded the files before they were saved. */
const passAfresh = async (root: string): Promise<WatchPass | { problem: string }> => {
  try {
    const { stdout } = await run(process.execPath, [process.argv[1], 'space', 'watch-pass'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024
    });
    const parsed: unknown = JSON.parse(stdout);

    return isPass(parsed) ? parsed : { problem: 'The pass did not answer with the space.' };
  } catch (error) {
    const printed = isRecord(error) && typeof error.stderr === 'string' ? error.stderr.trim() : '';

    return { problem: printed || (error instanceof Error ? error.message.split('\n')[0] : String(error)) };
  }
};

/**
 * `plitzi space watch-pass`, not listed: one pass as JSON — what `space watch` reads in a fresh process after a save.
 */
export const watchPass = async (): Promise<void> => {
  const project = await spaceProject('plitzi space watch', 'whose space to watch');
  if (!project) {
    return;
  }

  const { findings } = await spaceFindings(project);
  const loaded = await loadProjectSpace(project.root);
  if ('problem' in loaded) {
    console.log(JSON.stringify({ authors: false, problem: loaded.problem, findings } satisfies WatchPass));

    return;
  }

  let warnings: PassWarning[];
  try {
    warnings = authorSpace(loaded.space, loaded.authoring).warnings.map(({ code, message, elementId }) => ({
      code,
      message,
      ...(elementId === undefined ? {} : { elementId })
    }));
  } catch (error) {
    const problem = refusalOf(error).message.split('\n').slice(0, REFUSAL_LINES).join('\n');
    console.log(JSON.stringify({ authors: false, problem, findings } satisfies WatchPass));

    return;
  }

  const located = await locatedSpace(project.root);
  const pass: WatchPass =
    'problem' in located
      ? { authors: false, problem: located.problem, findings }
      : { authors: true, findings, warnings, readings: located.map(readingOf) };
  console.log(JSON.stringify(pass));
};

const findingLine = (sign: string, { severity, code, message, file, line }: LintFinding): string =>
  `  ${sign} ${severity} ${code}${file ? ` ${file}${line === undefined ? '' : `:${String(line)}`}` : ''} — ${message}`;

const warningLine = (sign: string, { code, elementId, message }: PassWarning): string =>
  `  ${sign} warning ${code}${elementId ? ` ${elementId}` : ''} — ${message}`;

const deltaLines = (
  findings: Delta<LintFinding>,
  warnings: Delta<PassWarning> = { added: [], resolved: [] }
): string[] => [
  ...warnings.added.map(each => chalk.yellow(warningLine('+', each))),
  ...findings.added.map(each => chalk.yellow(findingLine('+', each))),
  ...warnings.resolved.map(each => chalk.green(warningLine('−', each))),
  ...findings.resolved.map(each => chalk.green(findingLine('−', each)))
];

/** An event as lines a person scans. */
export const eventText = (event: WatchEvent): string => {
  switch (event.type) {
    case 'ready':
      return [
        event.authors
          ? chalk.green(
              `✓ the space authors — ${String(event.elements ?? 0)} elements, ${String(event.warnings.length)} warnings, ${String(event.findings.length)} findings`
            )
          : chalk.red(`✗ the space does not author: ${event.problem ?? ''}`),
        ...event.warnings.map(each => chalk.yellow(warningLine('·', each))),
        ...event.findings.map(each => chalk.yellow(findingLine('·', each))),
        chalk.dim(`Watching ${event.watching.join(', ')} — every save says what it changed. ^C to stop.`)
      ].join('\n');
    case 'pass':
      return [
        chalk.dim(`— ${event.files.join(', ')} (${String(event.ms)} ms)`),
        event.unchanged
          ? chalk.dim('  the save changed nothing in the space, and fixed or brought no problem')
          : chalk.green(
              `✓ authors — ${String(event.counts.warnings)} warnings, ${String(event.counts.findings)} findings`
            ),
        ...event.space.map(line => `  ${line}`),
        ...deltaLines(event.findings, event.warnings)
      ].join('\n');
    case 'refused':
      return [
        chalk.dim(`— ${event.files.join(', ')} (${String(event.ms)} ms)`),
        chalk.red(`✗ the space does not author: ${event.problem}`),
        ...deltaLines(event.findings)
      ].join('\n');
    case 'error':
      return [chalk.dim(`— ${event.files.join(', ')}`), chalk.red(`✗ the pass could not run: ${event.problem}`)].join(
        '\n'
      );
  }
};

/** The folders a save of the space is in: the space, its plugins, the data it reads — those the project has. */
export const watchedFolders = (root: string): string[] =>
  [SPACE_DIR, PLUGINS_DIR, DATA_DIR, path.join(PUBLIC_DIR, 'data')].filter(folder =>
    existsSync(path.join(root, folder))
  );

export const watchSpace = async (options: WatchOptions): Promise<void> => {
  const project = await spaceProject('plitzi space watch', 'whose space to watch');
  if (!project) {
    return;
  }

  const say = (event: WatchEvent): void => {
    console.log(options.json ? JSON.stringify(event) : eventText(event));
  };

  const { root } = project;
  const first = await passAfresh(root);
  if (!('authors' in first)) {
    fail(`The space could not be read: ${first.problem}`);

    return;
  }

  const folders = watchedFolders(root);
  say({
    type: 'ready',
    authors: first.authors,
    ...(first.authors ? { elements: first.readings.length } : { problem: first.problem }),
    findings: first.findings,
    warnings: first.authors ? first.warnings : [],
    watching: folders
  });

  let previous: WatchPass = first;
  let last = first.authors ? first : undefined;
  const saved = new Set<string>();
  let running = false;
  let pending: NodeJS.Timeout | undefined;

  const pass = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    const files = [...saved].sort();
    saved.clear();
    const started = Date.now();
    const current = await passAfresh(root);
    if ('authors' in current) {
      say(passEvent(previous, last, current, files, Date.now() - started));
      previous = current;
      last = current.authors ? current : last;
    } else {
      say({ type: 'error', files, problem: current.problem });
    }

    running = false;
    // Saved while it read: one more pass, for those.
    if (saved.size > 0) {
      void pass();
    }
  };

  for (const folder of folders) {
    watch(path.join(root, folder), { recursive: true }, (_event, file) => {
      // An editor's or a tool's scratch copy (`.index.ts.swp`, `.!123!index.ts`): no file of the space is hidden.
      if (file === null || path.basename(file).startsWith('.')) {
        return;
      }

      saved.add(path.join(folder, file));
      clearTimeout(pending);
      pending = setTimeout(() => void pass(), SETTLE_MS);
    });
  }
};
