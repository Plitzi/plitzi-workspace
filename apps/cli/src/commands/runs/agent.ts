import { spawn } from 'node:child_process';
import { closeSync, constants, openSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { act, runOf } from './shell';
import { agentPrompt, harnessCommand, HARNESSES, isHarness } from '../../runs/agentPrompt';
import { writeJson } from '../../runs/files';
import { tokenFile } from '../../runs/identity';
import { isPrincipal, LEAD_ROLE } from '../../runs/leads';
import { agentScratch } from '../../runs/paths';
import { RunRefusal } from '../../runs/refusal';
import { loadRun } from '../../runs/run';
import { readTeam, startedAgents } from '../../runs/team';

import type { RunCommandOptions } from './shell';
import type { Harness } from '../../runs/agentPrompt';
import type { StartedAgent } from '../../runs/team';

/**
 * `plitzi run agent <name>`: an agent of the run's team, started — its prompt written in its scratch, and the command
 * line that starts it headless in a harness; with `--launch`, started now, its output kept beside its prompt. What
 * every lead wrote by hand for each agent of each run, and a person new to Plitzi had no way to.
 */

export interface AgentOptions extends RunCommandOptions {
  harness?: string;
  launch?: boolean;
}

/** Whether a command is on this machine's PATH: a harness that is not installed is said, never started. */
export const onPath = async (command: string): Promise<boolean> => {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    if (
      await fs
        .access(path.join(dir, command), constants.X_OK)
        .then(() => true)
        .catch(() => false)
    ) {
      return true;
    }
  }

  return false;
};

/** The harness asked — or the one installed, when exactly one is: refused, naming them, otherwise. */
const harnessOf = async (asked: string | undefined): Promise<Harness> => {
  if (asked !== undefined) {
    if (!isHarness(asked)) {
      throw new RunRefusal('invalid', `--harness ${asked}: one of ${HARNESSES.join(', ')}`);
    }

    if (!(await onPath(asked))) {
      throw new RunRefusal('invalid', `--harness ${asked}: \`${asked}\` is not on this machine's PATH — install it`);
    }

    return asked;
  }

  const installed = (await Promise.all(HARNESSES.map(async each => ((await onPath(each)) ? [each] : [])))).flat();
  if (installed.length !== 1) {
    throw new RunRefusal(
      'invalid',
      installed.length === 0
        ? `No harness on this machine's PATH to start it in (${HARNESSES.join(', ')}): start it yourself with its prompt`
        : `Which harness: --harness ${installed.join(' | ')}`
    );
  }

  return installed[0];
};

/** The team's agent of that name — a lead that reviews (`lead-2`) by its role — or the lead, which the team has not. */
const startedOf = async (root: string, agent: string): Promise<StartedAgent | undefined> => {
  if (isPrincipal(agent)) {
    return undefined;
  }

  if (/^lead-\d+$/.test(agent)) {
    return { agent, roles: [LEAD_ROLE] };
  }

  const team = await readTeam(root);
  const started = team ? startedAgents(team) : [];
  const found = started.find(each => each.agent === agent);
  if (!found) {
    throw new RunRefusal(
      'not-found',
      `"${agent}" is no agent of the team (.plitzi/team.json): ${started.map(each => each.agent).join(', ') || 'none'}, or lead`
    );
  }

  return found;
};

export const runAgent = (agent: string, options: AgentOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const loaded = await loadRun(ctx, runId);
      const started = await startedOf(ctx.root, agent);
      const scratch = agentScratch(loaded.paths, agent);
      await fs.mkdir(scratch, { recursive: true });
      const prompt = agentPrompt({
        agent,
        ...(started ? { started } : {}),
        runId,
        root: ctx.root,
        tokenFile: tokenFile(loaded.paths, agent),
        goal: loaded.plan.goal,
        ...(loaded.plan.reference === undefined ? {} : { reference: loaded.plan.reference })
      });
      const promptFile = path.join(scratch, 'prompt.md');
      await fs.writeFile(promptFile, `${prompt}\n`);
      const model = started?.model?.model;
      const lines = HARNESSES.map(each => ({
        harness: each,
        line: harnessCommand(each, { file: promptFile, text: prompt }, model).line
      }));
      if (!options.launch) {
        return { agent, runId, promptFile, ...(model ? { model } : {}), commands: lines };
      }

      const harness = await harnessOf(options.harness);
      const { command, args, line } = harnessCommand(harness, { file: promptFile, text: prompt }, model);
      const log = path.join(scratch, 'agent.log');
      const out = openSync(log, 'a');
      // Its own process group, outliving this command: the agent works until task next tells it to stop.
      const child = spawn(command, args, { cwd: ctx.root, detached: true, stdio: ['ignore', out, out] });
      closeSync(out);
      child.unref();
      if (child.pid === undefined) {
        throw new RunRefusal('invalid', `${harness} did not start: ${line}`);
      }

      await writeJson(path.join(scratch, 'agent.json'), {
        pid: child.pid,
        harness,
        startedAt: ctx.now().toISOString(),
        log
      });

      return { agent, runId, promptFile, ...(model ? { model } : {}), launched: { harness, pid: child.pid, log } };
    },
    answer =>
      'launched' in answer
        ? [
            chalk.green(
              `${answer.agent} started in ${answer.launched.harness} (pid ${String(answer.launched.pid)})${answer.model ? ` on ${answer.model}` : ''}: it works until task next tells it to stop.`
            ),
            `  Its output: ${answer.launched.log} — its prompt: ${answer.promptFile}`,
            `  Follow the run: plitzi run monitor ${answer.runId} (a person) · plitzi run watch ${answer.runId} --until lead (the lead)`
          ].join('\n')
        : [
            `${answer.agent}'s prompt for run "${answer.runId}": ${answer.promptFile}`,
            '  Start it as a subagent of your harness with that prompt — or headless, in a terminal of its own:',
            ...('commands' in answer ? answer.commands : []).map(each => `    ${each.line}`),
            `  …or let the CLI start it: plitzi run agent ${answer.agent} --launch --harness <${HARNESSES.join('|')}>`
          ].join('\n')
  );
