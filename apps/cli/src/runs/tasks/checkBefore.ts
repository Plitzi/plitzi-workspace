import fs from 'node:fs/promises';
import path from 'node:path';

import { checkAcceptance } from '../acceptance';
import { exists } from '../files';
import { under } from '../paths';
import { approvedCopy, SERVED_STATUSES } from '../preview';
import { RunRefusal } from '../refusal';
import { loadRun } from '../run';
import { viewTask } from '../taskStore';
import { findTask } from './common';

import type { AcceptanceResult } from '../model';
import type { RunContext } from '../run';

/**
 * `plitzi task check <task> --before`: its acceptance run on its copy and on the run before it — the run's approved
 * work without it — line by line, as `task look --before` sets its pages beside the run before. A line proves the
 * change when it fails without it and passes with it; one that passes on both proves nothing of it. encore-13's tester,
 * reviewing a test's fix, copied the spec without the new line into its scratch with a playwright config of its own to
 * see it fail there.
 */

/** What one acceptance line says of the change: run on the run before it, then on the task's copy. */
export interface LineBeforeAfter {
  said: string;
  check: string;
  before: AcceptanceResult;
  after: AcceptanceResult;
}

export const checkBefore = async (
  ctx: RunContext,
  runId: string,
  taskId: string
): Promise<{ task: string; lines: LineBeforeAfter[]; without: string[] }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = findTask(loaded, taskId);
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
  await fs.mkdir(beforeCache, { recursive: true });
  // A task of tests is proved by failing on the code it tests: its "before" is the run's work without that task's
  // change too — the project's own version of its files — or every line passes on both (encore-14's tester).
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

    const after = await checkAcceptance(task.acceptance, {
      work: view.paths.work,
      root: ctx.root,
      cache: view.paths.cache
    });
    const before = await checkAcceptance(task.acceptance, { work: beforeDir, root: ctx.root, cache: beforeCache });

    return {
      task: taskId,
      without,
      lines: after.map((line, index) => ({
        said: line.said,
        check: line.check,
        before: before[index] ?? { said: line.said, check: line.check, ok: false, output: ['not run'] },
        after: line
      }))
    };
  } finally {
    await fs.rm(beforeDir, { recursive: true, force: true });
  }
};

/** What a line says of the change, from how it ran before it and with it. */
export const provedBy = (line: LineBeforeAfter): 'proves' | 'proves-nothing' | 'fails' | 'unanswered' =>
  line.after.unanswered === true || line.before.unanswered === true
    ? 'unanswered'
    : !line.after.ok
      ? 'fails'
      : line.before.ok
        ? 'proves-nothing'
        : 'proves';
