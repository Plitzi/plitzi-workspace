import chalk from 'chalk';

import { taskSeeStage } from './seeStage';
import { act, either } from './shell';
import { taskCheck } from './work';
import { RunRefusal } from '../../runs/refusal';
import { checkBefore, provedBy } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { LineBeforeAfter } from '../../runs/tasks';

export type CheckCommandOptions = RunCommandOptions & {
  acceptance?: boolean;
  fix?: boolean;
  fresh?: boolean;
  tasks?: string;
  before?: boolean;
};

/** `plitzi task check`: your copy's checks, a research card's stage (`--tasks`), or a task beside the run before it. */
export const taskCheckCommand = (named: string | undefined, options: CheckCommandOptions): Promise<void> => {
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
          `task check runs your own copy's checks and names no task — ${String(named)} is named to set it beside the run before it: plitzi task check ${String(named)} --before`
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
    ({ task, lines }) => checkBeforeText(task, lines)
  );

const LAST_LINES = 4;

/** Its lines as a reviewer weighs them: what each proves of the change, then what it printed where it failed. */
export const checkBeforeText = (task: string, lines: readonly LineBeforeAfter[]): string => {
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
    `${task}'s acceptance, before it (the run's approved work) and with it (its copy) — ${String(proving)} of ${String(lines.length)} ${lines.length === 1 ? 'line proves' : 'lines prove'} the change:`,
    ...said
  ].join('\n');
};
