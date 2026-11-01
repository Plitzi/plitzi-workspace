import { isRunning, readLaunch } from './launch';
import { agentsNow } from './running';
import { startHolds } from './startHold';
import { readTeam, startedAgents } from './team';
import { RunRefusal } from '../core/refusal';
import { viewTask } from '../core/taskStore';
import { loadRun, logRun, readRunLog } from '../run';
import { requirePrincipal } from '../run/context';

import type { StartHold } from './startHold';
import type { RunContext } from '../run';

/**
 * `plitzi run hold` and `plitzi run allow`: the lead or a person stops agents of the run — their process ended, what
 * they hold kept in their hands, never started again by the run — and lets them start again. The same hold the run puts
 * on an agent whose harness ends as it starts (`startHold.ts`), lifted the same way.
 */

/** The holds on the run's agents now, as the lead's view reads them. */
export const holdsNow = async (ctx: RunContext, runId: string): Promise<Map<string, StartHold>> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const team = await readTeam(ctx.root).catch(() => undefined);
  const log = await readRunLog(loaded.paths);
  const { running } = await agentsNow(loaded.paths, views, team, log, ctx.now());

  return startHolds(
    loaded.paths,
    {
      notRunning: (team ? startedAgents(team) : []).map(each => each.agent).filter(agent => !running.has(agent)),
      harness: team?.options?.launch
    },
    log,
    ctx.now().getTime()
  );
};

/** The team's agents asked for by name — every one when none is named: refused, naming them, for one it has not. */
const agentsAsked = async (ctx: RunContext, asked: readonly string[]): Promise<string[]> => {
  const team = await readTeam(ctx.root).catch(() => undefined);
  const agents = (team ? startedAgents(team) : []).map(each => each.agent);
  const unknown = asked.filter(agent => !agents.includes(agent));
  if (unknown.length > 0) {
    throw new RunRefusal(
      'not-found',
      `${unknown.join(', ')}: no agent of the team (.plitzi/team.json) — ${agents.join(', ') || 'it has none'}`
    );
  }

  return asked.length > 0 ? [...new Set(asked)] : agents;
};

/** An agent held: whether its process was ended, and the tasks it keeps in hand. */
export interface AgentHeld {
  agent: string;
  ended: boolean;
  holds: string[];
}

export const holdAgents = async (
  ctx: RunContext,
  runId: string,
  asked: readonly string[]
): Promise<{ held: AgentHeld[]; already: string[] }> => {
  requirePrincipal(ctx, 'hold an agent');
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const agents = await agentsAsked(ctx, asked);
  const holds = await holdsNow(ctx, runId);
  const already = agents.filter(agent => holds.get(agent)?.why === 'stopped');
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const held: AgentHeld[] = [];
  for (const agent of agents.filter(each => !already.includes(each))) {
    // Held before its process ends: the run, seeing it gone, finds it held — never a start between the two.
    await logRun(ctx, loaded.paths, { action: 'agent-held', agent });
    const launch = await readLaunch(loaded.paths, agent);
    const ended = launch !== undefined && isRunning(launch);
    if (launch && ended) {
      // Its own process group (`launchAgent` starts it detached): the harness and whatever it started go with it.
      try {
        process.kill(-launch.pid, 'SIGTERM');
      } catch {
        // Gone between the look and the signal: what was asked is so.
      }
    }

    held.push({
      agent,
      ended,
      holds: views.filter(view => view.owner?.agent === agent && view.state.status !== 'done').map(view => view.task.id)
    });
  }

  return { held, already };
};

export const allowAgents = async (
  ctx: RunContext,
  runId: string,
  asked: readonly string[]
): Promise<{ allowed: StartHold[]; notHeld: string[] }> => {
  requirePrincipal(ctx, 'allow an agent to start');
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const holds = await holdsNow(ctx, runId);
  const agents = asked.length > 0 ? await agentsAsked(ctx, asked) : [...holds.keys()];
  const allowed = agents.flatMap(agent => holds.get(agent) ?? []);
  const notHeld = agents.filter(agent => !holds.has(agent));
  if (allowed.length > 0) {
    await logRun(ctx, loaded.paths, { action: 'starts-allowed', agents: allowed.map(each => each.agent) });
  }

  return { allowed, notHeld };
};
