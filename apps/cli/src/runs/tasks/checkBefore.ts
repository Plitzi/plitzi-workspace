import fs from 'node:fs/promises';
import path from 'node:path';

import { findTask } from './common';
import { neverRan, portBusy } from './neverRan';
import { writtenSince } from './pairApproval';
import { checkAcceptance, ranNoTest, sayLines } from '../copies/acceptance';
import { approvedCopy, SERVED_STATUSES } from '../copies/preview';
import { exists } from '../core/files';
import { acceptanceText } from '../core/model';
import { under } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { readStart, viewTask } from '../core/taskStore';
import { loadRun } from '../run';

import type { Acceptance, AcceptanceResult } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { RunContext } from '../run';

/**
 * `plitzi task prove <task> --before`: its acceptance run on its copy and on the run before it — the run's approved
 * work without it — line by line, as `task look --before` sets its pages beside the run before. A line proves the
 * change when it fails without it and passes with it; one that passes on both proves nothing of it. A run's tester,
 * reviewing a test's fix, copied the spec without the new line into its scratch with a playwright config of its own to
 * see it fail there.
 */

/**
 * A task with only the acceptance lines asked, by their place: proving a unit test held its mutant cost a Playwright
 * run per mutant, the task's other lines run with it. A place it has not is refused, naming its lines.
 */
export const linesOf = <T extends { id: string; acceptance: readonly Acceptance[] }>(
  task: T,
  only: readonly number[]
): T => {
  if (only.length === 0) {
    return task;
  }

  const missing = only.filter(place => !Number.isInteger(place) || place < 1 || place > task.acceptance.length);
  if (missing.length > 0) {
    throw new RunRefusal(
      'invalid',
      `${task.id}'s acceptance has ${String(task.acceptance.length)} lines: plitzi task prove ${task.id} --line ${missing.join(', ')} names none — ${task.acceptance.map((line, index) => `${String(index + 1)} ${acceptanceText(line)}`).join('; ')}`,
      { task: task.id }
    );
  }

  return { ...task, acceptance: task.acceptance.filter((_line, index) => only.includes(index + 1)) };
};

/** What one acceptance line says of the change: run on the run before it, then on the task's copy. */
export interface LineBeforeAfter {
  said: string;
  check: string;
  before: AcceptanceResult;
  after: AcceptanceResult;
  /**
   * It fails before only on the tests the task adds — on the run without them it passes: a guard of what was there
   * ("the charts' tests pass as they were"), its proof the new test beside them in the same file.
   */
  byOwnTests?: true;
}

export const checkBefore = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  /** The acceptance's lines to run, by their place (1 the first): all of them when left out. */
  only: readonly number[] = []
): Promise<{ task: string; lines: LineBeforeAfter[]; without: string[]; afterAsCompleted?: true }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = linesOf(findTask(loaded, taskId), only);
  const view = await viewTask(loaded.paths, task);
  if (!SERVED_STATUSES.includes(view.state.status)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}: its acceptance is set beside the run before it while it has a copy — worked or in review`,
      { task: taskId }
    );
  }

  const checked = task.acceptance.filter(line => typeof line !== 'string');
  if (checked.length === 0) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" has no acceptance line a command checks: nothing to run before and after it`,
      { task: taskId }
    );
  }

  // The run before it in a folder of its own, made afresh: its state cold, and no server of a look's touched.
  const beforeDir = path.join(view.paths.cache, 'check-before');
  const beforeCache = path.join(view.paths.cache, 'check-before-cache');
  const bareDir = path.join(view.paths.cache, 'check-before-bare');
  await fs.mkdir(beforeCache, { recursive: true });
  // A task of tests is proved by failing on the code it tests: its "before" is the run's work without that task's
  // change too — the project's own version of its files — or every line passes on both (a run's tester).
  const without = task.testsOf ?? [];
  try {
    await approvedCopy(ctx, loaded, beforeDir);
    for (const file of without.flatMap(id => loaded.tasks.find(each => each.id === id)?.files ?? [])) {
      const original = under(ctx.root, file);
      const placed = under(beforeDir, file);
      await fs.rm(placed, { recursive: true, force: true });
      if (await exists(original)) {
        await fs.cp(original, placed, { recursive: true });
      }
    }

    // Its own tests run on the code before it: the run's old test file passed the old code and proved nothing, and a
    // spec it adds was "No tests found" there — a failure that proved nothing either.
    const ownTests: string[] = [];
    for (const file of [...task.files, ...(task.touches ?? [])].filter(isTestFile)) {
      if (await exists(under(view.paths.work, file))) {
        ownTests.push(file);
      }
    }

    // …and kept bare too, the run without anything of it: a task whose change is its tests themselves (every spec moved
    // onto a fixture) had that change put back by its own tests, and a line reading the specs passed before it.
    if (ownTests.length > 0) {
      await fs.rm(bareDir, { recursive: true, force: true });
      await fs.cp(beforeDir, bareDir, { recursive: true });
    }

    for (const file of ownTests) {
      await fs.mkdir(path.dirname(under(beforeDir, file)), { recursive: true });
      await fs.cp(under(view.paths.work, file), under(beforeDir, file));
    }

    const measured = await asCompleted(view, task.acceptance);
    if (measured) {
      ctx.say?.('with it: as its complete measured it — its copy unchanged since');
    }

    const after =
      measured ??
      (await checkAcceptance(task.acceptance, {
        work: view.paths.work,
        root: ctx.root,
        cache: view.paths.cache,
        ...sayLines(ctx.say, 'with it')
      }));
    const placed = await checkAcceptance(task.acceptance, {
      work: beforeDir,
      root: ctx.root,
      cache: beforeCache,
      ...sayLines(ctx.say, 'before it')
    });
    // A line that passes with its tests on the code before it is run once more, on the run bare: failing there, the
    // change it sees is its tests'. One that fails with them and runs one of them, too: passing bare, what fails before
    // it is only what the task adds.
    const runsOwn = (index: number): boolean =>
      ownTests.some(file => (placed[index]?.check ?? '').includes(path.basename(file)));
    const again =
      ownTests.length > 0 ? placed.flatMap((line, index) => (line.ok || runsOwn(index) ? [index] : [])) : [];
    const bare =
      again.length > 0
        ? await checkAcceptance(
            task.acceptance.filter((_line, index) => again.includes(index)),
            { work: bareDir, root: ctx.root, cache: beforeCache }
          )
        : [];
    const bareOf = (index: number): AcceptanceResult | undefined =>
      again.includes(index) ? bare.at(again.indexOf(index)) : undefined;
    const before = placed.map((line, index) => {
      const bareLine = bareOf(index);

      return line.ok && bareLine !== undefined && !bareLine.ok && !ranNoTest((bareLine.output ?? []).join('\n'))
        ? bareLine
        : line;
    });

    return {
      task: taskId,
      without,
      ...(measured ? { afterAsCompleted: true as const } : {}),
      lines: after.map((line, index) => ({
        said: line.said,
        check: line.check,
        before: before[index] ?? { said: line.said, check: line.check, ok: false, output: ['not run'] },
        after: line,
        ...(placed.at(index)?.ok === false && bareOf(index)?.ok === true ? { byOwnTests: true as const } : {})
      }))
    };
  } finally {
    await fs.rm(beforeDir, { recursive: true, force: true });
    await fs.rm(bareDir, { recursive: true, force: true });
  }
};

/**
 * What its `complete` measured of the task's acceptance, while its copy holds what went to review and nothing since: the
 * same lines on the same files answer the same. A run's reviews ran a page's 4-minute spec again on the copy its
 * complete had just run it on, one Playwright at a time on the machine, every other agent waiting behind it.
 */
export const asCompleted = async (
  view: TaskView,
  acceptance: readonly Acceptance[]
): Promise<AcceptanceResult[] | undefined> => {
  const { accepted, submitted } = view.state;
  const start = await readStart(view.paths);
  if (view.state.status !== 'in-review' || !accepted || !submitted || !start) {
    return undefined;
  }

  if ((await writtenSince(view, start, submitted)).length > 0) {
    return undefined;
  }

  const lines: AcceptanceResult[] = [];
  for (const line of acceptance) {
    if (typeof line === 'string') {
      continue;
    }

    // A line amended since is a place kept for its first run, never a result: a run's prove read five amended lines as
    // failing "with it", run on nothing.
    const measured = accepted.find(each => each.check === line.check);
    if (measured === undefined || measured.amended !== undefined) {
      return undefined;
    }

    lines.push(measured);
  }

  return lines;
};

/** A test file, by its name: what a task's own tests are, run on the code before it. */
const isTestFile = (file: string): boolean => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);

/** A line that ran no test before it answers nothing of it: what it runs did not exist there. */
export const noTestBefore = (line: LineBeforeAfter): boolean =>
  !line.before.ok && ranNoTest((line.before.output ?? []).join('\n'));

/**
 * What a line says of the change, from how it ran before it and with it. A before that never ran — a module the change
 * added, still imported without it: the server stopped — proves nothing, as a mutant that never runs does (a run's
 * lead read "it proves the change" of a before whose server never answered).
 */
export const provedBy = (line: LineBeforeAfter): 'proves' | 'proves-nothing' | 'fails' | 'unanswered' | 'broken' =>
  line.after.unanswered === true ||
  line.before.unanswered === true ||
  noTestBefore(line) ||
  portBusy(line.before.output) ||
  portBusy(line.after.output)
    ? 'unanswered'
    : !line.after.ok
      ? 'fails'
      : line.before.ok
        ? 'proves-nothing'
        : neverRan(line.before.output)
          ? 'broken'
          : 'proves';
