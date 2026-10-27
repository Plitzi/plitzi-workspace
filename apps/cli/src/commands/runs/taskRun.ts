import chalk from 'chalk';

import { act, runOf, tokenTask } from './shell';
import { messageLines } from './text';
import { durationText } from '../../options';
import { runOwnCommand } from '../../runs/ownCommand';

import type { RunCommandOptions } from './shell';
import type { OwnCommandRun } from '../../runs/ownCommand';

/** What `task run` printed: how it ended, what failed and its end, where the rest is, and what was said meanwhile. */
export const ownRunText = (ran: OwnCommandRun): string =>
  [
    `${ran.code === 0 ? '✓' : chalk.yellow('✗')} ${ran.command} — exit ${String(ran.code)} in ${durationText(ran.ms)}${ran.suite ? ', in its turn on the machine (one Playwright suite at a time)' : ''}`,
    ...ran.lines.map(line => `    ${line}`),
    chalk.dim(
      `  All it printed (${String(ran.printed)} lines): ${ran.log} — grep or tail it, rather than run it again`
    ),
    ...messageLines(ran.messages)
  ].join('\n');

/** `plitzi task run "<command>"`: a command of your own, run as the run's checks are (`runs/ownCommand.ts`). */
export const taskRun = (command: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const task = tokenTask(ctx);

      return runOwnCommand(ctx, await runOf(ctx, options), command, {
        ...(task ? { task } : {}),
        onWait: since =>
          console.error(
            `Waiting for another agent's Playwright suite on this machine${since ? ` (since ${since.slice(11, 19)} UTC)` : ''}: yours runs once it ends.`
          )
      });
    },
    ownRunText,
    ran => (ran.code === 0 ? 0 : 1)
  );
