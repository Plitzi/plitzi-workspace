import chalk from 'chalk';

import { RunRefusal } from '../../../runs/core/refusal';
import { caughtBy, checkBefore, checkMutant, failedTests, noTestBefore, provedBy } from '../../../runs/tasks';
import { act, either } from '../shell';

import type { LineBeforeAfter, LineMutated, Mutation } from '../../../runs/tasks';
import type { RunCommandOptions } from '../shell';

export type ProveOptions = RunCommandOptions & {
  before?: boolean;
  /** `--mutate <file>`: the file a mutant changes, `--from` what it says and `--to` what it says instead — each said again for a change more. */
  mutate?: string[];
  from?: string[];
  to?: string[];
  /** `--line <n>`: the acceptance lines it runs, by their place — each said again. */
  line?: string[];
};

/** The places `--line` named, as numbers: one that is not is said as it is, and refused by the task's lines. */
const linesAsked = (options: ProveOptions): number[] => (options.line ?? []).map(Number);

/** Whether a mutant is asked: any of its three flags given, each refused below unless all three are whole. */
const mutantAsked = (options: ProveOptions): boolean =>
  [options.mutate, options.from, options.to].some(each => (each ?? []).length > 0);

/**
 * `plitzi task prove [task] --before | --mutate <file> --from "…" --to "…"`: what a task's acceptance proves — each line
 * beside the run before the task, or on a mutant of its copy. A reviewer's; its own checks are `task check`.
 */
export const taskProve = (named: string | undefined, options: ProveOptions): Promise<void> =>
  mutantAsked(options) ? taskProveMutant(named, options) : taskProveBefore(named, options);

/** `plitzi task prove [task] --before`: each acceptance line run before the task and with it — what it proves. */
const taskProveBefore = (named: string | undefined, options: ProveOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.before !== true) {
        throw new RunRefusal(
          'invalid',
          `task prove says what an acceptance proves, one way at a time: beside the run before the task (plitzi task prove ${named ?? '[task]'} --before), or on a mutant of its copy (plitzi task prove ${named ?? '[task]'} --mutate <file> --from "…" --to "…")`
        );
      }

      const { runId, taskId } = await either(ctx, options, named);

      return checkBefore(ctx, runId, taskId, linesAsked(options));
    },
    ({ task, lines, without }) => checkBeforeText(task, lines, without)
  );

const LAST_LINES = 4;

/** Its lines as a reviewer weighs them: what each proves of the change, then what it printed where it failed. */
export const checkBeforeText = (
  task: string,
  lines: readonly LineBeforeAfter[],
  /** The tasks it tests, taken out of the run before it as well. */
  without: readonly string[] = []
): string => {
  const said = lines.map(line => {
    const proved = provedBy(line);
    const head =
      proved === 'proves'
        ? `${chalk.green('✓')} ${line.said} — fails before ${task}, passes with it: it proves the change`
        : proved === 'proves-nothing'
          ? `${chalk.yellow('·')} ${line.said} — passes before ${task} too: it holds what was there already (a guard, as it may be meant), not the change`
          : proved === 'fails'
            ? `${chalk.yellow('✗')} ${line.said} — fails with ${task}${line.before.ok ? ', where it passed before it' : ', as before it'}`
            : noTestBefore(line)
              ? `${chalk.yellow('?')} ${line.said} — ran no test before ${task}: what it runs did not exist there, so it proves nothing either way — break the code it holds and see it fail: plitzi task prove ${task} --mutate <file> --from "…" --to "…"`
              : `${chalk.yellow('?')} ${line.said} — could not be answered ${line.after.unanswered === true ? 'with' : 'before'} ${task}: the line's or the machine's, not the work's`;
    const printed = [
      ...(!line.before.ok && proved !== 'proves' ? [['before', line.before.output ?? []] as const] : []),
      ...(!line.after.ok ? [['with it', line.after.output ?? []] as const] : []),
      ...(proved === 'proves' ? [['before', line.before.output ?? []] as const] : [])
    ].flatMap(([where, output]) =>
      output.length === 0 ? [] : [chalk.dim(`    ${where}: ${output.slice(-LAST_LINES).join(' ⏎ ')}`)]
    );

    return [`  ${head}`, ...printed].join('\n');
  });
  const proving = lines.filter(line => provedBy(line) === 'proves').length;

  return [
    `${task}'s acceptance, before it (the run's approved work${without.length > 0 ? `, without ${without.join(', ')}, which it tests` : ''}) and with it (its copy) — ${String(proving)} of ${String(lines.length)} ${lines.length === 1 ? 'line proves' : 'lines prove'} the change:`,
    ...said
  ].join('\n');
};

/** `plitzi task prove [task] --mutate <file> --from "…" --to "…"`: each acceptance line run on a mutant of the copy. */
const taskProveMutant = (named: string | undefined, options: ProveOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { mutate: files = [], from = [], to = [] } = options;
      if (files.length === 0 || files.length !== from.length || files.length !== to.length) {
        throw new RunRefusal(
          'invalid',
          'A mutant is each change said whole — --mutate <file> --from "what the code says" --to "what it says instead", the three again for each change more'
        );
      }

      if (options.before === true) {
        throw new RunRefusal(
          'invalid',
          'task prove says what an acceptance proves one way at a time: --before, or --mutate — run them one after the other'
        );
      }

      const { runId, taskId } = await either(ctx, options, named);

      return checkMutant(
        ctx,
        runId,
        taskId,
        files.map((file, index) => ({ file, from: from[index] ?? '', to: to[index] ?? '' })),
        linesAsked(options)
      );
    },
    ({ task, mutations, lines }) => checkMutantText(task, mutations, lines),
    ({ lines }) => (lines.some(line => caughtBy(line) === 'catches') ? 0 : 1)
  );

/** Its lines as a reviewer weighs a task of tests: which hold the behaviour the mutant breaks, and which let it pass. */
export const checkMutantText = (
  task: string,
  mutations: readonly Mutation[],
  lines: readonly LineMutated[]
): string => {
  const said = lines.map(line => {
    const caught = caughtBy(line);
    const head =
      caught === 'catches'
        ? `${chalk.green('✓')} ${line.said} — fails on the mutant: it holds what the change breaks`
        : caught === 'misses'
          ? `${chalk.yellow('·')} ${line.said} — passes on the mutant too: what it breaks goes unseen by this line`
          : caught === 'fails'
            ? `${chalk.yellow('✗')} ${line.said} — fails on ${task}'s copy already: it says nothing of the mutant`
            : caught === 'broken'
              ? `${chalk.yellow('?')} ${line.said} — the mutant does not run (an error of its own, not a test's): it proves nothing — change the code so it still runs`
              : `${chalk.yellow('?')} ${line.said} — could not be answered on the ${line.copy.unanswered === true ? 'copy' : 'mutant'}: the line's or the machine's`;
    const output =
      caught === 'catches' || caught === 'broken'
        ? line.mutant.output
        : caught === 'fails'
          ? line.copy.output
          : undefined;
    // Which test failed first, then its last lines: a tester could not tell the new test from an older one.
    const shown =
      output === undefined
        ? []
        : [...new Set([...failedTests(output).slice(0, LAST_LINES), ...output.slice(-LAST_LINES)])];

    return [
      `  ${head}`,
      ...(shown.length === 0
        ? []
        : [chalk.dim(`    ${caught === 'fails' ? 'on the copy' : 'on the mutant'}: ${shown.join(' ⏎ ')}`)])
    ].join('\n');
  });
  const catching = lines.filter(line => caughtBy(line) === 'catches').length;

  return [
    `${task}'s acceptance, on its copy and on a mutant of it (${mutations.map(each => `${each.file}: "${each.from}" → "${each.to}"`).join('; ')}) — ${String(catching)} of ${String(lines.length)} ${lines.length === 1 ? 'line catches' : 'lines catch'} it${catching === 0 ? ': none fails on it — nothing holds that behaviour, or the code holds it in another place too (a mutant that changes nothing a visitor or a caller sees): change that place as well, --mutate again' : ''}:`,
    ...said
  ].join('\n');
};
