import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { findProject } from './existingProject';
import { projectFormatter } from './projectFormatter';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { unifiedDiff } from '../fix/diff';
import { formatLikeBefore } from '../fix/format';
import { projectPlan, verdict } from '../fix/plan';
import { applyChanges, pruneImports, sourceEdit } from '../fix/sourceEdits';
import { loadTypeScript } from '../projectTypeScript';

import type { ProjectPlan } from '../fix/plan';
import type { TextChange } from '../fix/sourceEdits';
import type { PlannedFix } from '@plitzi/sdk-authoring';

/**
 * `plitzi fix`: what authoring the space would fix, as edits to the project's own source — shown as a diff, and with
 * `--write` written, formatted as the project formats, and checked: the space is authored again in a fresh process,
 * and unless every fix written is gone and no problem was added, every file goes back to what it was.
 *
 * Only what has one reading is fixed (the fixes `fixSpace` makes), and only where it is written as a literal in the
 * call that wrote the element; everything else is said, with where it is, for the author.
 *
 *   plitzi fix            # the diff
 *   plitzi fix --write    # written, then checked
 */

export interface FixOptions {
  write?: boolean;
  json?: boolean;
}

const run = promisify(execFile);

/** A fix the source can take: where, and the change. */
interface Placed {
  fix: PlannedFix;
  file: string;
  changes: TextChange[];
  /** The imports the change may have left unused. */
  orphans: readonly string[];
}

/** Edits planned, made: each file's text before and after, and the fixes that are left for the author. */
interface Edited {
  files: { file: string; before: string; after: string }[];
  written: PlannedFix[];
  left: { fix: PlannedFix; why: string }[];
}

const editSources = async (root: string, fixes: readonly PlannedFix[]): Promise<Edited> => {
  const ts = loadTypeScript(root);
  const placed: Placed[] = [];
  const left: Edited['left'] = [];
  const sources = new Map<string, { text: string; sourceFile: import('typescript').SourceFile }>();

  for (const fix of fixes) {
    if (!fix.edit || !fix.position) {
      left.push({ fix, why: fix.position ? 'it has no one way to be written' : 'no call of the project wrote it' });
      continue;
    }

    if (!ts) {
      left.push({ fix, why: 'the project has no TypeScript to read its source with' });
      continue;
    }

    const file = path.resolve(process.cwd(), fix.position.file);
    let source = sources.get(file);
    if (!source) {
      const text = await fs.readFile(file, 'utf-8');
      source = { text, sourceFile: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) };
      sources.set(file, source);
    }

    const outcome = sourceEdit(ts, source.sourceFile, fix.position, fix.edit);
    if ('unplaced' in outcome) {
      left.push({ fix, why: outcome.unplaced });
    } else {
      placed.push({ fix, file, changes: outcome.changes, orphans: outcome.orphans ?? [] });
    }
  }

  const format = await projectFormatter(root);
  const files: Edited['files'] = [];
  const written: PlannedFix[] = [];
  for (const [file, { text }] of sources) {
    const mine = placed.filter(entry => entry.file === file);
    const changed = applyChanges(
      text,
      mine.flatMap(entry => entry.changes)
    );
    if (changed === undefined) {
      left.push(...mine.map(entry => ({ fix: entry.fix, why: 'it overlaps another fix in the same place' })));
      continue;
    }

    if (mine.length > 0) {
      const orphans = [...new Set(mine.flatMap(entry => entry.orphans))];
      const pruned = ts && orphans.length > 0 ? pruneImports(ts, file, changed, orphans) : changed;
      files.push({
        file,
        before: text,
        after: await formatLikeBefore(format, path.relative(root, file), text, pruned)
      });
      written.push(...mine.map(entry => entry.fix));
    }
  }

  return { files, written, left };
};

/** A plan as `plitzi fix --json` prints it. */
const planFromJson = (stdout: string): ProjectPlan => {
  const parsed: unknown = JSON.parse(stdout);
  if (!isRecord(parsed)) {
    return { problem: 'the space did not answer as a plan' };
  }

  if (typeof parsed.problem === 'string') {
    return { problem: parsed.problem };
  }

  const entries = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
  const elementOf = (entry: Record<string, unknown>): string | null =>
    typeof entry.elementId === 'string' ? entry.elementId : null;

  return {
    fixes: entries(parsed.fixes).map(entry => ({
      code: String(entry.code),
      elementId: elementOf(entry),
      message: String(entry.message)
    })),
    problems: entries(parsed.problems).map(entry => ({
      code: String(entry.code),
      elementId: elementOf(entry),
      message: String(entry.message)
    }))
  };
};

/** The plan, made in a process of its own: the edited files are imported fresh, never from this one's module cache. */
const planAfresh = async (): Promise<ProjectPlan> => {
  try {
    const { stdout } = await run(process.execPath, [process.argv[1], 'fix', '--json'], {
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024
    });

    return planFromJson(stdout);
  } catch (error) {
    // A plan with a problem exits 1 and still prints it: that is the answer, not a failure to get one.
    const printed = isRecord(error) && typeof error.stdout === 'string' ? error.stdout.trim() : '';
    if (printed.startsWith('{')) {
      return planFromJson(printed);
    }

    return { problem: error instanceof Error ? error.message.split('\n').slice(0, 3).join(' ') : String(error) };
  }
};

const leftText = (left: Edited['left']): string[] =>
  left.length === 0
    ? []
    : [
        chalk.yellow(`${String(left.length)} left for you:`),
        ...left.map(({ fix, why }) => `  - ${fix.at ? `${fix.at} ` : ''}[${fix.code}] ${fix.message} (${why})`)
      ];

export const fix = async (options: FixOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project || project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    fail(
      'Run this in a project whose space is written in it (`src/space/`): one kept on Plitzi is fixed in the builder.'
    );

    return;
  }

  const loaded = await loadProjectSpace(project.root);
  if ('problem' in loaded) {
    fail(loaded.problem);

    return;
  }

  const plan = projectPlan(loaded);
  if (options.json) {
    console.log(JSON.stringify(plan));
    if ('problem' in plan) {
      process.exitCode = 1;
    }

    return;
  }

  if ('problem' in plan) {
    fail(`Nothing to plan: ${plan.problem}. \`npm run author\` says what to change first.`);

    return;
  }

  if (plan.fixes.length === 0) {
    console.log(chalk.green('Nothing to fix.'));

    return;
  }

  const edited = await editSources(project.root, plan.fixes);
  const diffs = edited.files.map(({ file, before, after }) =>
    unifiedDiff(path.relative(process.cwd(), file), before, after)
  );

  if (!options.write) {
    console.log(
      [
        ...diffs,
        ...(edited.written.length > 0
          ? [chalk.green(`${String(edited.written.length)} to write: plitzi fix --write`)]
          : []),
        ...leftText(edited.left)
      ].join('\n')
    );

    return;
  }

  // Written, checked, and kept only if the space authors with each fix gone and no problem added. A fix that adds one
  // goes back to the author with the reason, and the rest are written again without it.
  let attempt = edited;
  const refused: Edited['left'] = [];
  for (;;) {
    await Promise.all(attempt.files.map(({ file, after }) => fs.writeFile(file, after)));
    const { reasons, elements } = verdict(plan, attempt.written, await planAfresh());
    if (reasons.length === 0) {
      break;
    }

    await Promise.all(attempt.files.map(({ file, before }) => fs.writeFile(file, before)));
    const blamed = attempt.written.filter(entry => elements.has(null) || elements.has(entry.elementId));
    const why = `writing it would leave the space with ${reasons.join('; ')}`;
    refused.push(...blamed.map(entry => ({ fix: entry, why })));
    const rest = attempt.written.filter(entry => !blamed.includes(entry));
    if (blamed.length === 0 || rest.length === 0) {
      fail(['Nothing was written — the source is as it was:', ...reasons.map(reason => `  - ${reason}`)].join('\n'));
      console.log(leftText([...edited.left, ...refused]).join('\n'));

      return;
    }

    attempt = await editSources(project.root, rest);
  }

  console.log(
    [
      ...attempt.files.map(({ file, before, after }) => unifiedDiff(path.relative(process.cwd(), file), before, after)),
      chalk.green(
        `Wrote ${String(attempt.written.length)} ${attempt.written.length === 1 ? 'fix' : 'fixes'} in ${String(attempt.files.length)} ${attempt.files.length === 1 ? 'file' : 'files'}; the space authors with them gone. Typecheck the project before calling it done.`
      ),
      ...leftText([...edited.left, ...refused])
    ].join('\n')
  );
};
