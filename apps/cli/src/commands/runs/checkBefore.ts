import chalk from 'chalk';

import { taskSeeStage } from './seeStage';
import { act, either } from './shell';
import { taskCheck } from './work';
import { RunRefusal } from '../../runs/refusal';
import { caughtBy, checkBefore, checkMutant, provedBy } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { LineBeforeAfter, LineMutated, Mutation } from '../../runs/tasks';

export type CheckCommandOptions = RunCommandOptions & {
  acceptance?: boolean;
  fix?: boolean;
  fresh?: boolean;
  tasks?: string;
  before?: boolean;
  /** `--mutate <file>`: the file a mutant changes, `--from` what it says and `--to` what it says instead. */
  mutate?: string;
  from?: string;
  to?: string;
};

/** `plitzi task check`: your copy's checks, a research card's stage (`--tasks`), or a task beside the run before it. */
export const taskCheckCommand = (named: string | undefined, options: CheckCommandOptions): Promise<void> => {
  if (options.mutate !== undefined || options.from !== undefined || options.to !== undefined) {
    return taskCheckMutant(named, options);
  }

  if (options.before === true || named !== undefined) {
    return taskCheckBefore(named, options);
  }

  return options.tasks === undefined ? taskCheck(options) : taskSeeStage({ ...options, tasks: options.tasks });
};

/** `plitzi task check [task] --before`: each acceptance line run before the task and with it — what it proves. */
const taskCheckBefore = (named: string | undefined, options: CheckCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.before !== true) {
        throw new RunRefusal(
          'invalid',
          `task check runs your own copy's checks and names no task — ${String(named)} is named to set it beside the run before it (plitzi task check ${String(named)} --before) or a mutant of it (plitzi task check ${String(named)} --mutate <file> --from "…" --to "…")`
        );
      }

      if (options.fix === true || options.tasks !== undefined || options.acceptance === true) {
        throw new RunRefusal(
          'invalid',
          '--before runs the acceptance alone, before the task and with it: leave out --fix, --tasks and --acceptance'
        );
      }

      const { runId, taskId } = await either(ctx, options, named);

      return checkBefore(ctx, runId, taskId);
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
          ? `${chalk.yellow('·')} ${line.said} — passes before ${task} too: it proves nothing of the change`
          : proved === 'fails'
            ? `${chalk.yellow('✗')} ${line.said} — fails with ${task}${line.before.ok ? ', where it passed before it' : ', as before it'}`
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

/** `plitzi task check [task] --mutate <file> --from "…" --to "…"`: each acceptance line run on a mutant of the copy. */
const taskCheckMutant = (named: string | undefined, options: CheckCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { mutate: file, from, to } = options;
      if (file === undefined || from === undefined || to === undefined) {
        throw new RunRefusal(
          'invalid',
          'A mutant is one change, said whole: --mutate <file> --from "what the code says" --to "what it says instead"'
        );
      }

      if (
        options.before === true ||
        options.fix === true ||
        options.tasks !== undefined ||
        options.acceptance === true
      ) {
        throw new RunRefusal(
          'invalid',
          '--mutate runs the acceptance alone, on the copy and on its mutant: leave out --before, --fix, --tasks and --acceptance'
        );
      }

      const { runId, taskId } = await either(ctx, options, named);

      return checkMutant(ctx, runId, taskId, { file, from, to });
    },
    ({ task, mutation, lines }) => checkMutantText(task, mutation, lines),
    ({ lines }) => (lines.some(line => caughtBy(line) === 'catches') ? 0 : 1)
  );

/** Its lines as a reviewer weighs a task of tests: which hold the behaviour the mutant breaks, and which let it pass. */
export const checkMutantText = (task: string, mutation: Mutation, lines: readonly LineMutated[]): string => {
  const said = lines.map(line => {
    const caught = caughtBy(line);
    const head =
      caught === 'catches'
        ? `${chalk.green('✓')} ${line.said} — fails on the mutant: it holds what the change breaks`
        : caught === 'misses'
          ? `${chalk.yellow('·')} ${line.said} — passes on the mutant too: what it breaks goes unseen by this line`
          : caught === 'fails'
            ? `${chalk.yellow('✗')} ${line.said} — fails on ${task}'s copy already: it says nothing of the mutant`
            : `${chalk.yellow('?')} ${line.said} — could not be answered on the ${line.copy.unanswered === true ? 'copy' : 'mutant'}: the line's or the machine's`;
    const output = caught === 'catches' ? line.mutant.output : caught === 'fails' ? line.copy.output : undefined;

    return [
      `  ${head}`,
      ...(output === undefined || output.length === 0
        ? []
        : [
            chalk.dim(
              `    ${caught === 'catches' ? 'on the mutant' : 'on the copy'}: ${output.slice(-LAST_LINES).join(' ⏎ ')}`
            )
          ])
    ].join('\n');
  });
  const catching = lines.filter(line => caughtBy(line) === 'catches').length;

  return [
    `${task}'s acceptance, on its copy and on a mutant of it (${mutation.file}: "${mutation.from}" → "${mutation.to}") — ${String(catching)} of ${String(lines.length)} ${lines.length === 1 ? 'line catches' : 'lines catch'} it${catching === 0 ? ': nothing holds that behaviour' : ''}:`,
    ...said
  ].join('\n');
};
