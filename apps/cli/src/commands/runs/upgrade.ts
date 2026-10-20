import { spawn } from 'node:child_process';

import chalk from 'chalk';

import { contextFor, runOf } from './shell';
import { isRunRefusal } from '../../runs/refusal';
import { requirePerson, resumeRun, stopRun, writingTasks } from '../../runs/run';

import type { RunCommandOptions } from './shell';

/**
 * `plitzi run upgrade`: Plitzi upgraded under an open run without breaking it — a person's, in their terminal. The run
 * stops gently (what is being written finishes and goes to review, nothing starts), Plitzi is upgraded once nothing is
 * being written — `node_modules` never changes under an agent's command — and the new CLI re-pins the run (`run
 * attach`, the tasks in hand keep their copies) and opens it again; the agents waiting with `task next --follow` go on.
 * An upgrade that fails leaves the run as it was, opened again.
 */

export interface UpgradeRunOptions extends RunCommandOptions {
  /** The command that upgrades, run in the project — `plitzi upgrade --write --with-open-runs` when not said. */
  install?: string;
  /** How long to wait for what is being written, in ms. */
  timeout?: number;
}

/** A command in the project, on the person's terminal: what it says is theirs to read, and so is a prompt it asks. */
const inTerminal = (command: string, args: string[], shell = false): Promise<number> =>
  new Promise(resolve => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: 'inherit', shell });
    child.on('close', code => resolve(code ?? 1));
  });

/** This CLI as installed now: after the upgrade, the new one — what re-pins the run must be the version it pins. */
const plitzi = (args: string[]): Promise<number> => inTerminal(process.execPath, [process.argv[1], ...args]);

const say = (line: string): void => console.log(chalk.bold('[run upgrade] ') + line);

export const runUpgrade = async (runId: string | undefined, options: UpgradeRunOptions): Promise<void> => {
  try {
    const ctx = await contextFor(options);
    const id = await runOf(ctx, options, runId);
    await requirePerson(
      ctx,
      id,
      `stop run "${id}" once what is being written is in review, upgrade Plitzi, re-pin the run and open it again`
    );
    await stopRun(
      ctx,
      id,
      false,
      'stopping to upgrade Plitzi: the tasks in hand finish, then it is upgraded and resumed'
    );
    say('Stopping: the tasks in hand finish and go to review, none starts; the agents wait.');

    const started = Date.now();
    const timeoutMs = options.timeout ?? 60 * 60_000;
    let said = '';
    for (;;) {
      const writing = await writingTasks(ctx, id);
      if (writing.length === 0) {
        break;
      }

      const now = `still being written: ${writing.join(', ')}`;
      if (now !== said) {
        say(now);
        said = now;
      }

      if (Date.now() - started > timeoutMs) {
        say(
          chalk.yellow(
            `Waited ${String(Math.round(timeoutMs / 60_000))} min: ${writing.join(', ')} still being written. Nothing was upgraded; the run stays stopping — run this again, or resume it (plitzi run resume ${id})`
          )
        );
        process.exitCode = 1;

        return;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    say('Nothing is being written: upgrading Plitzi. A preview (start:preview) stops with it: start it again after.');
    const upgraded = options.install
      ? await inTerminal(options.install, [], true)
      : await plitzi(['upgrade', '--write', '--with-open-runs']);
    if (upgraded !== 0) {
      await resumeRun(ctx, id);
      say(
        chalk.red(
          `The upgrade failed (${String(upgraded)}): nothing of the run changed, and it is open again as it was.`
        )
      );
      process.exitCode = upgraded;

      return;
    }

    say('Upgraded. The new Plitzi re-pins the run — type its name once more:');
    const attached = await plitzi(['run', 'attach', id]);
    if (attached !== 0) {
      say(
        chalk.yellow(
          `Not re-pinned: the run stays stopping. Re-pin and open it: plitzi run attach ${id} && plitzi run resume ${id}`
        )
      );
      process.exitCode = attached;

      return;
    }

    process.exitCode = await plitzi(['run', 'resume', id]);
    say('The run goes on with the new Plitzi; the agents waiting with task next --follow pick it up.');
  } catch (error) {
    if (!isRunRefusal(error)) {
      throw error;
    }

    console.error(`${chalk.red(`Refused (${error.code}):`)} ${error.message}\n  ${chalk.dim(`Next: ${error.next}`)}`);
    process.exitCode = error.exitCode;
  }
};
