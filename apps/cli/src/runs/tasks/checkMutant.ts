import fs from 'node:fs/promises';
import path from 'node:path';

import { asCompleted, linesOf } from './checkBefore';
import { findTask } from './common';
import { neverRan, portBusy } from './neverRan';
import { scriptsOf } from '../../commands/project/verify';
import { projectRun } from '../../scaffold/packageManager';
import { checkAcceptance, sayLines } from '../copies/acceptance';
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
  only: readonly number[] = [],
  /**
   * The project's own tests run too, a line of their own (`--tests`): what a line a reviewer judges — "mapped from the
   * member code, tested" — leans on, which a tester had to reason out with a probe of its own.
   */
  { tests = false }: { tests?: boolean } = {}
): Promise<{ task: string; mutations: Mutation[]; lines: LineMutated[] }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const asked = linesOf(findTask(loaded, taskId), only);
  const view = await viewTask(loaded.paths, asked);
  const testScript = tests ? (await scriptsOf(view.paths.work)).test : undefined;
  if (tests && testScript === undefined) {
    throw new RunRefusal(
      'invalid',
      `${taskId}'s project has no test script to run on the mutant (package.json "test")`,
      {
        task: taskId
      }
    );
  }

  const task =
    testScript === undefined
      ? asked
      : { ...asked, acceptance: [...asked.acceptance, { said: 'The project’s tests', check: projectRun('test') }] };
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

    // Its copy as its complete measured it, unchanged since: only the mutant is run.
    const copy =
      (await asCompleted(view, task.acceptance)) ??
      (await checkAcceptance(task.acceptance, {
        work: view.paths.work,
        root: ctx.root,
        cache: view.paths.cache,
        ...sayLines(ctx.say, 'its copy')
      }));
    const mutant = await checkAcceptance(task.acceptance, {
      work: dir,
      root: ctx.root,
      cache,
      ...sayLines(ctx.say, 'the mutant')
    });

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
  const asserted = assertionsOf(output);
  const tail = output
    .filter(
      line =>
        !FAILED_TEST.test(line) && !ASSERTION_FIELD.test(line) && !STACK_FRAME.test(line) && !PIPE_CLOSED.test(line)
    )
    .slice(-last);

  return [
    ...(names.length > 0 ? [`${String(names.length)} failed — ${names.join(' · ')}`] : []),
    ...asserted.map(message => `asserted: ${message}`),
    ...tail.filter(line => !asserted.some(message => line.includes(message)))
  ].join(' ⏎ ');
};

/**
 * What an assertion said when it failed — node's `AssertionError [ERR_ASSERTION]: no spike`, an `Error: …`: the line a
 * tester tells two asserts of one test apart by. The tail of node:test's failure is the error's fields
 * (`expected: true, operator: '==', diff: 'simple' }`), and a tester made a second mutant to find which one caught it.
 */
const ASSERTION = /^\s*(?:AssertionError(?: \[ERR_ASSERTION\])?|Error|TypeError|RangeError): (.+)$/;

/**
 * A frame of the runner's own stack (`at Test.postRun (node:internal/test_runner/test:974:18)`): where node was, nothing
 * of the test — a tester read node's frames listed after the tests that caught its mutant, as if they were tests too. A
 * frame in the project's files says where in the test it failed, and stays.
 */
const STACK_FRAME = /^\s*at\s(?:.*\()?node:[^)]*\)?\s*$/;

/** The fields node prints of an assertion's error, after its message: nothing a review reads. */
const ASSERTION_FIELD = /^\s*(?:generatedMessage|code|actual|expected|operator|diff): |^\s*\}\s*$/;

/** How many assertions' messages a failure says: the first few, each once. */
const ASSERTIONS_SAID = 3;

/** A matcher's own words (`expect(received).toEqual(expected)`): the same for every assert, telling none apart. */
const MATCHER = /^expect\(/;

/**
 * The command's own pipe breaking — `write EPIPE`, and node's `Emitted 'error' event on Socket` after it: a check that
 * pipes into `grep -q` closes the output as soon as it has its answer, and the runner, still writing, says so. Nothing
 * a test asserted, though it reads like one, and a tester took it for the mutant's failure.
 */
const PIPE_CLOSED = /\bEPIPE\b|Emitted 'error' event on Socket|Emitted error event on Socket/;

/** An assertion's own error, before a bare `Error:` a library threw on the way: the line the test wrote comes first. */
const ASSERTION_ERROR = /^\s*AssertionError/;

const assertionsOf = (output: readonly string[]): string[] => {
  const said = output.flatMap(line => {
    const message = ASSERTION.exec(line)?.[1]?.trim();

    return message === undefined || MATCHER.test(message) || PIPE_CLOSED.test(line)
      ? []
      : [{ message, asserted: ASSERTION_ERROR.test(line) }];
  });

  return [
    ...new Set(
      [...said.filter(each => each.asserted), ...said.filter(each => !each.asserted)].map(each => each.message)
    )
  ].slice(0, ASSERTIONS_SAID);
};

/**
 * What a line says of the mutant: it catches it, lets it pass, fails already on the copy, breaks — the mutant does not
 * run — or could not answer.
 */
export const caughtBy = (line: LineMutated): 'catches' | 'misses' | 'fails' | 'broken' | 'unanswered' =>
  line.copy.unanswered === true ||
  line.mutant.unanswered === true ||
  portBusy(line.copy.output) ||
  portBusy(line.mutant.output)
    ? 'unanswered'
    : !line.copy.ok
      ? 'fails'
      : line.mutant.ok
        ? 'misses'
        : neverRan(line.mutant.output)
          ? 'broken'
          : 'catches';
