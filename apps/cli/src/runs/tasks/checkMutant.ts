import fs from 'node:fs/promises';
import path from 'node:path';

import { checkAcceptance } from '../acceptance';
import { cloneFiles, isCopied, projectFiles, readOptional } from '../files';
import { under } from '../paths';
import { SERVED_STATUSES } from '../preview';
import { RunRefusal } from '../refusal';
import { loadRun } from '../run';
import { viewTask } from '../taskStore';
import { findTask } from './common';

import type { AcceptanceResult } from '../model';
import type { RunContext } from '../run';

/**
 * `plitzi task check <task> --mutate <file> --from "…" --to "…"`: its acceptance run on its copy, and on a throwaway
 * copy of it with one change made to the code — a mutant. A line that passes on the copy and fails on the mutant holds
 * that behaviour; one that passes on both lets it break unseen. encore-14's tester, reviewing tasks of tests, copied the
 * task's `src/` into its scratch, changed the code under test with sed and ran `node --test` there by hand — twice.
 */

/** The change made to the copy: one place of one file, quoted whole. */
export interface Mutation {
  file: string;
  from: string;
  to: string;
}

/** What one acceptance line says of the mutant: run on the task's copy, then on the copy changed. */
export interface LineMutated {
  said: string;
  check: string;
  copy: AcceptanceResult;
  mutant: AcceptanceResult;
}

/** The mutation said back, checked: a file of the project's source, and the text to change found once in it. */
const mutated = (text: string, mutation: Mutation): string => {
  if (mutation.from === '') {
    throw new RunRefusal('invalid', '--from is the text to change, quoted whole: it is empty');
  }

  if (mutation.from === mutation.to) {
    throw new RunRefusal('invalid', '--from and --to are the same: no change is made — say what the code becomes');
  }

  const times = text.split(mutation.from).length - 1;
  if (times !== 1) {
    throw new RunRefusal(
      'invalid',
      times === 0
        ? `${mutation.file} has no "${mutation.from}": quote it as the file writes it — spaces and quotes too`
        : `${mutation.file} has "${mutation.from}" ${String(times)} times: quote more of the line, so it names one place`
    );
  }

  return text.replace(mutation.from, () => mutation.to);
};

export const checkMutant = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  mutation: Mutation
): Promise<{ task: string; mutation: Mutation; lines: LineMutated[] }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (!SERVED_STATUSES.includes(view.state.status)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}: a mutant is made of its copy, which it has while worked or in review`,
      { task: taskId }
    );
  }

  if (!task.acceptance.some(line => typeof line !== 'string')) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" has no acceptance line a command checks: nothing to run on the mutant`,
      { task: taskId }
    );
  }

  const file = path.posix.normalize(mutation.file);
  const inside = !file.startsWith('..') && !path.isAbsolute(file);
  const text = inside ? (await readOptional(under(view.paths.work, file)))?.toString('utf-8') : undefined;
  if (text === undefined) {
    throw new RunRefusal(
      'invalid',
      `${mutation.file} is no file of ${taskId}'s copy: name it by its project path (src/functions/shows.ts)`,
      { task: taskId }
    );
  }

  const changed = mutated(text, { ...mutation, file });
  // The copy as it is, in a folder of its own: what a copy never holds — the project's served binaries — from the
  // project, as the run's own copies get them.
  const dir = path.join(view.paths.cache, 'check-mutant');
  const cache = path.join(view.paths.cache, 'check-mutant-cache');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(cache, { recursive: true });
  try {
    const held = await projectFiles(view.paths.work);
    await cloneFiles(view.paths.work, dir, held);
    const kept = new Set(held);
    await cloneFiles(
      ctx.root,
      dir,
      (await projectFiles(ctx.root)).filter(each => !kept.has(each) && !isCopied(each, kept))
    );
    await fs.writeFile(under(dir, file), changed);

    const copy = await checkAcceptance(task.acceptance, {
      work: view.paths.work,
      root: ctx.root,
      cache: view.paths.cache
    });
    const mutant = await checkAcceptance(task.acceptance, { work: dir, root: ctx.root, cache });

    return {
      task: taskId,
      mutation: { ...mutation, file },
      lines: copy.map((line, index) => ({
        said: line.said,
        check: line.check,
        copy: line,
        mutant: mutant[index] ?? { said: line.said, check: line.check, ok: false, output: ['not run'] }
      }))
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/** What a line says of the mutant: it catches it, lets it pass, fails already on the copy, or could not answer. */
export const caughtBy = (line: LineMutated): 'catches' | 'misses' | 'fails' | 'unanswered' =>
  line.copy.unanswered === true || line.mutant.unanswered === true
    ? 'unanswered'
    : !line.copy.ok
      ? 'fails'
      : line.mutant.ok
        ? 'misses'
        : 'catches';
