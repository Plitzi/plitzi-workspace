import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, constants, openSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { agentPrompt, harnessCommand, HARNESSES, isHarness } from './agentPrompt';
import { issueToken, writeCli } from './identity';
import { isRunning, readLaunch, resumable, writeLaunch } from './launch';
import { isPrincipal, LEAD_ROLE } from './leads';
import { agentScratch } from './paths';
import { RunRefusal } from './refusal';
import { loadRun, logRun, readRunLog } from './run';
import { SESSION_ENV } from './session';
import { viewTask } from './taskStore';
import { leadStart, readTeam, startedAgents } from './team';

import type { Harness } from './agentPrompt';
import type { NoResume } from './launch';
import type { RunContext } from './run';
import type { StartedAgent } from './team';

/**
 * An agent of the run's team, prepared — its token, its own CLI, its prompt in its scratch — and started headless in a
 * harness: what `plitzi run agent <name> --launch` does, and what `run watch --until lead` does by itself for the agents
 * the run asks for when the team says so (`options.launch`). Either way a launch is the same: refused for an agent
 * still running, resuming the session of one that died mid-task when the team asks it, logged for the board.
 */

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
export const harnessOf = async (asked: string | undefined): Promise<Harness> => {
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

/**
 * The team's agent of that name — a lead that reviews (`lead-2`) by its role — or, for the lead, what the team starts
 * it on alone: the lead is no agent of the team, but its model and effort are the team's to say.
 */
const startedOf = async (
  root: string,
  agent: string
): Promise<{ started?: StartedAgent; start: Pick<StartedAgent, 'model' | 'effort'> }> => {
  const team = await readTeam(root);
  if (isPrincipal(agent)) {
    return { start: leadStart(team?.lead) };
  }

  if (/^lead-\d+$/.test(agent)) {
    const start = leadStart(team?.lead);

    return { started: { agent, roles: [LEAD_ROLE], ...start }, start };
  }

  const started = team ? startedAgents(team) : [];
  const found = started.find(each => each.agent === agent);
  if (!found) {
    throw new RunRefusal(
      'not-found',
      `"${agent}" is no agent of the team (.plitzi/team.json): ${started.map(each => each.agent).join(', ') || 'none'}, or lead`
    );
  }

  return { started: found, start: found };
};

/** An agent's prompt, written in its scratch, and the command line each harness would start it with. */
export interface AgentPrompted {
  agent: string;
  runId: string;
  promptFile: string;
  model?: string;
  effort?: string;
  commands: { harness: Harness; line: string }[];
}

export interface AgentLaunched {
  agent: string;
  runId: string;
  promptFile: string;
  /** The model it runs on, as the harness was told it. */
  model?: string;
  /** How hard it thinks, as the harness was told it. */
  effort?: string;
  /** The team's model, where this harness does not run it: the agent on the harness's own default. */
  modelNotRun?: string;
  launched: { harness: Harness; pid: number; log: string };
  /** The session it resumed (`resumeSession`), cut off mid-task. */
  resumed?: string;
  /** Why it started fresh though the team asked it to resume. */
  fresh?: { not: NoResume; bytes?: number };
}

const prepare = async (ctx: RunContext, runId: string, agent: string) => {
  const loaded = await loadRun(ctx, runId);
  const { started, start } = await startedOf(ctx.root, agent);
  const scratch = agentScratch(loaded.paths, agent);
  await fs.mkdir(scratch, { recursive: true });
  // Made as it is started, so its prompt names its own CLI from its first command: one the lead started has its
  // token already, and its CLI is written again — the same file.
  await issueToken(loaded.paths, runId, agent, ctx.now());
  const cli = await writeCli(loaded.paths, agent);
  const prompt = agentPrompt({
    agent,
    ...(started ? { started } : {}),
    runId,
    root: ctx.root,
    cli,
    goal: loaded.plan.goal,
    ...(loaded.plan.reference === undefined ? {} : { reference: loaded.plan.reference })
  });
  const promptFile = path.join(scratch, 'prompt.md');
  await fs.writeFile(promptFile, `${prompt}\n`);
  const told = {
    ...(start.model ? { model: start.model.model } : {}),
    ...(start.effort ? { effort: start.effort } : {})
  };
  const lines = HARNESSES.map(each => ({
    harness: each,
    line: harnessCommand(each, { file: promptFile, text: prompt }, told).line
  }));

  return { loaded, started, scratch, cli, prompt, promptFile, told, lines };
};

/** The agent's prompt and how each harness would start it — nothing started. */
export const promptAgent = async (ctx: RunContext, runId: string, agent: string): Promise<AgentPrompted> => {
  const { promptFile, told, lines } = await prepare(ctx, runId, agent);

  return { agent, runId, promptFile, ...told, commands: lines };
};

/** Starts the agent now, in `harness`: refused while it still runs. */
export const launchAgent = async (
  ctx: RunContext,
  runId: string,
  agent: string,
  harness: Harness
): Promise<AgentLaunched> => {
  const { loaded, started, scratch, cli, prompt, promptFile, told } = await prepare(ctx, runId, agent);
  const { model } = told;
  const last = await readLaunch(loaded.paths, agent);
  // Two sessions of one agent read one log: the new one took the old one's completion for its own and stopped
  // (encore: dev-2 started again while its last session was still writing its stop).
  if (last && isRunning(last)) {
    throw new RunRefusal(
      'invalid',
      `${agent} is running (pid ${String(last.pid)}, ${last.harness}, started ${last.startedAt}): it goes on by itself — let it finish, or stop it first (kill ${String(last.pid)}) and start it again`
    );
  }

  const held = (await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)))).filter(
    view => view.owner?.agent === agent && view.state.status === 'in-progress'
  );
  const lastWord = (await readRunLog(loaded.paths)).findLast(entry => entry.by === agent)?.action;
  const resume = await resumable(ctx.root, last, {
    asked: started?.resumeSession === true,
    harness,
    midTask: held.length > 0 && lastWord !== 'stops'
  });
  const session = 'session' in resume ? { id: resume.session, resume: true } : { id: randomUUID(), resume: false };
  const said = session.resume
    ? `You were cut off mid-task (${held.map(view => view.task.id).join(', ')}): the machine or your harness went down. Your copy is as you left it. Run ${cli} task next first — it hands your task back — and go on where you were.`
    : prompt;
  const {
    command,
    args,
    line,
    model: ran,
    effort
  } = harnessCommand(harness, { file: promptFile, text: said }, told, harness === 'claude' ? session : undefined);
  const log = path.join(scratch, 'agent.log');
  const out = openSync(log, 'a');
  // Its own process group, outliving this command: the agent works until task next tells it to stop.
  // Every command it runs says its session (`SESSION_ENV`): a run reads which session did what, never guesses it.
  const child = spawn(command, args, {
    cwd: ctx.root,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, [SESSION_ENV]: session.id }
  });
  closeSync(out);
  child.unref();
  if (child.pid === undefined) {
    throw new RunRefusal('invalid', `${harness} did not start: ${line}`);
  }

  await writeLaunch(loaded.paths, agent, {
    pid: child.pid,
    harness,
    startedAt: ctx.now().toISOString(),
    log,
    ...(harness === 'claude' ? { session: session.id } : {})
  });
  // The lead's work as much as a review: the board says who started whom, and the lead is seen at it.
  await logRun(ctx, loaded.paths, {
    action: 'launch',
    agent,
    harness,
    ...(session.resume ? { resumed: true } : {})
  });

  return {
    agent,
    runId,
    promptFile,
    ...(ran ? { model: ran } : {}),
    ...(effort ? { effort } : {}),
    // The team's model, where this harness does not run it: said, the agent on the harness's own default.
    ...(model && !ran ? { modelNotRun: model } : {}),
    launched: { harness, pid: child.pid, log },
    ...(session.resume ? { resumed: session.id } : 'not' in resume ? { fresh: resume } : {})
  };
};
