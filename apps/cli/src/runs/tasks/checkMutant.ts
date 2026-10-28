import fs from 'node:fs/promises';
import path from 'node:path';

import { linesOf } from './checkBefore';
import { findTask } from './common';
import { checkAcceptance } from '../copies/acceptance';
import { SERVED_STATUSES } from '../copies/preview';
import { cloneFiles, isCopied, projectFiles, readOptional } from '../core/files';
import { under } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { viewTask } from '../core/taskStore';
import { loadRun } from '../run';

import type { AcceptanceResult } from '../core/model';
import type { RunContext } from '../run';

/**
 * `plitzi task prove <task> --mutate <file> --from "…" --to "…"`: its acceptance run on its copy, and on a throwaway
 * copy of it with one change made to the code — a mutant. A line that passes on the copy and fails on the mutant holds
 * that behaviour; one that passes on both lets it break unseen. A run's tester, reviewing tasks of tests, copied the
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

/**
 * Where the file writes `wanted` with other spaces — `"skipped": true` for `"skipped":true`: its own text, to quote. A
 * tester's mutant of a data file was refused, the file laid out one row a line with spaces its generator never wrote.
 */
const asWritten = (text: string, wanted: string): string | undefined => {
  const chars = wanted.replace(/\s+/g, '').match(/./gsu) ?? [];
  if (chars.length === 0) {
    return undefined;
  }

  const pattern = new RegExp(chars.map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));

  return pattern.exec(text)?.[0];
};

/** The mutation said back, checked: a file of the project's source, and the text to change found once in it. */
const mutated = (text: string, mutation: Mutation): string => {
  if (mutation.from === '') {
    throw new RunRefusal('invalid', '--from is the text to change, quoted whole: it is empty');
  }

  if (mutation.from === mutation.to) {
    throw new RunRefusal('invalid', '--from and --to are the same: no change is made — say what the code becomes');
  }

  const times = text.split(mutation.from).length - 1;
  if (times > 1) {
    // Each place said, its line whole: a tester quoted more of the line twice before one named a single place.
    const lines = text.split('\n');
    const places = lines.flatMap((line, index) =>
      line.includes(mutation.from) ? [`line ${String(index + 1)}: ${line.trim()}`] : []
    );
    throw new RunRefusal(
      'invalid',
      `${mutation.file} has "${mutation.from}" ${String(times)} times — ${places.join(' · ')} — quote more of the one you mean`
    );
  }

  if (times === 0) {
    const written = asWritten(text, mutation.from);
    throw new RunRefusal(
      'invalid',
      written === undefined
        ? `${mutation.file} has no "${mutation.from}": quote it as the file writes it — spaces and quotes too`
        : `${mutation.file} has no "${mutation.from}" — it writes it "${written}": quote that`
    );
  }

  return text.replace(mutation.from, () => mutation.to);
};

export const checkMutant = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  /** One change or several — a behaviour the code holds in two places breaks only with both changed. */
  mutations: readonly Mutation[],
  /** The acceptance's lines to run, by their place (1 the first): all of them when left out. */
  only: readonly number[] = []
): Promise<{ task: string; mutations: Mutation[]; lines: LineMutated[] }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = linesOf(findTask(loaded, taskId), only);
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

  if (mutations.length === 0) {
    throw new RunRefusal(
      'invalid',
      'A mutant is a change at least: plitzi task prove <task> --mutate <file> --from "…" --to "…"'
    );
  }

  // Each change on the text the ones before it left: two in one file are made one after the other.
  const texts = new Map<string, string>();
  const made: Mutation[] = [];
  for (const mutation of mutations) {
    const file = path.posix.normalize(mutation.file);
    const inside = !file.startsWith('..') && !path.isAbsolute(file);
    const text =
      texts.get(file) ?? (inside ? (await readOptional(under(view.paths.work, file)))?.toString('utf-8') : undefined);
    if (text === undefined) {
      throw new RunRefusal(
        'invalid',
        `${mutation.file} is no file of ${taskId}'s copy: name it by its project path (src/functions/shows.ts)`,
        { task: taskId }
      );
    }

    texts.set(file, mutated(text, { ...mutation, file }));
    made.push({ ...mutation, file });
  }

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
    for (const [file, text] of texts) {
      await fs.writeFile(under(dir, file), text);
    }

    const copy = await checkAcceptance(task.acceptance, {
      work: view.paths.work,
      root: ctx.root,
      cache: view.paths.cache
    });
    const mutant = await checkAcceptance(task.acceptance, { work: dir, root: ctx.root, cache });

    return {
      task: taskId,
      mutations: made,
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

/**
 * A mutant that does not run — a name it does not define, a type it breaks, a syntax error: its failure is its own, and
 * proves nothing a test holds (a tester's mutant naming no defined name read "fails on the mutant: it holds it").
 */
const BROKEN = /\b(?:ReferenceError|SyntaxError|TypeError: \S+ is not a function)\b|error TS\d+:/;

/** The lines a failure names its tests by: node's `✖ name`, TAP's `not ok`, Playwright's and vitest's `✘`/`×`/`FAIL`. */
const FAILED_TEST = /^\s*(?:✖|✘|×|not ok\b|FAIL\b|\d+\) )/;

/** What of a failure says which test failed, before its last lines: a tester could not tell which test caught it. */
const failedTests = (output: readonly string[]): string[] => output.filter(line => FAILED_TEST.test(line));

/**
 * The tests a failure names, each once — its marker, its number and its time left out: Playwright names each failed test
 * as it runs and again in its summary, and a tester read two of three from a cut of the tail, never how many.
 */
export const failedNames = (output: readonly string[]): string[] => [
  ...new Set(
    failedTests(output).map(line =>
      line
        .replace(/^\s*(?:✖|✘|×|not ok\s+\d+\s*-?|FAIL|\d+\))\s*(?:\d+\s+)?/, '')
        .replace(/\s*\(\d+(?:\.\d+)?m?s\)\s*$/, '')
        .trim()
    )
  )
];

/** What a failure printed, as a review reads it: how many tests failed and each by name, then its last lines. */
export const failureText = (output: readonly string[], last: number): string => {
  const names = failedNames(output);
  const tail = output.filter(line => !FAILED_TEST.test(line)).slice(-last);

  return [...(names.length > 0 ? [`${String(names.length)} failed — ${names.join(' · ')}`] : []), ...tail].join(' ⏎ ');
};

/**
 * What a line says of the mutant: it catches it, lets it pass, fails already on the copy, breaks — the mutant does not
 * run — or could not answer.
 */
export const caughtBy = (line: LineMutated): 'catches' | 'misses' | 'fails' | 'broken' | 'unanswered' =>
  line.copy.unanswered === true || line.mutant.unanswered === true
    ? 'unanswered'
    : !line.copy.ok
      ? 'fails'
      : line.mutant.ok
        ? 'misses'
        : (line.mutant.output ?? []).some(each => BROKEN.test(each))
          ? 'broken'
          : 'catches';
