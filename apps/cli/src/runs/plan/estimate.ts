import { roleOf } from './spike';
import { chainMinutes } from './urgency';
import { readHistory } from '../report/history';

import type { RunTask } from '../core/model';
import type { History } from '../report/history';

/** How long a plan takes, and with how many agents at once: what `run open --dry-run` says, and a person confirms. */

export interface PlanEstimate {
  tasks: number;
  agents: number;
  totalMinutes: number;
  criticalPathMinutes: number;
  /** About as long as the run takes with `agents` at once: the longer of the critical path and the work shared out. */
  wallMinutes: number;
  /** One review each at least; more for each round of changes. */
  reviewRounds: number;
  needsConfirmation: boolean;
  why?: string;
  /** At this project's pace — its past runs' minutes over their estimates — when it has enough of them to say. */
  paced?: { from: History['from']; wallMinutes: number; ratio: number; runs: number; tasks: number };
}

/** Above either, a person confirms the estimate before the run opens. */
export const CONFIRM_ABOVE = { agents: 5, wallMinutes: 120 } as const;

/**
 * How many of the tasks can be worked at once: the widest level of the plan — tasks with as many before them — each
 * role's share of it held to the agents that take that role (`takers`). a run's three research cards read "3
 * agents at once" with one scout in the team.
 */
const widthOf = (tasks: readonly RunTask[], takers?: (role: string) => number): number => {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) {
      return known;
    }

    const value = Math.max(-1, ...(byId.get(id)?.dependsOn ?? []).map(depthOf)) + 1;
    depth.set(id, value);

    return value;
  };
  const levels = new Map<number, Map<string, number>>();
  for (const task of tasks) {
    const level = levels.get(depthOf(task.id)) ?? new Map<string, number>();
    level.set(roleOf(task), (level.get(roleOf(task)) ?? 0) + 1);
    levels.set(depthOf(task.id), level);
  }

  return Math.max(
    1,
    ...[...levels.values()].map(level =>
      [...level].reduce((sum, [role, count]) => sum + (takers ? Math.min(count, Math.max(1, takers(role))) : count), 0)
    )
  );
};

export const estimate = (
  tasks: readonly RunTask[],
  agentsAsked: number,
  /** How many of the team take a role — none: the lead, one. Left out, any agent takes any task. */
  takers?: (role: string) => number
): PlanEstimate => {
  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimateMinutes, 0);
  const chains = chainMinutes(tasks);
  const roots = tasks.filter(task => task.dependsOn.length === 0);
  const criticalPathMinutes = Math.max(0, ...roots.map(task => chains.get(task.id) ?? 0));
  const agents = Math.max(1, Math.min(agentsAsked, widthOf(tasks, takers)));
  const wallMinutes = Math.ceil(Math.max(criticalPathMinutes, totalMinutes / agents));
  const reasons = [
    agentsAsked > CONFIRM_ABOVE.agents
      ? `up to ${String(agentsAsked)} agents at once (more than ${String(CONFIRM_ABOVE.agents)})`
      : '',
    wallMinutes > CONFIRM_ABOVE.wallMinutes
      ? `about ${String(wallMinutes)} minutes (more than ${String(CONFIRM_ABOVE.wallMinutes)})`
      : ''
  ].filter(Boolean);

  return {
    tasks: tasks.length,
    agents,
    totalMinutes,
    criticalPathMinutes,
    wallMinutes,
    reviewRounds: tasks.length,
    needsConfirmation: reasons.length > 0,
    ...(reasons.length > 0 ? { why: reasons.join(', ') } : {})
  };
};

/** Each task's estimate scaled to how this project's runs went: a task of no less than a minute. */
export const atPace = (tasks: readonly RunTask[], ratio: number): RunTask[] =>
  tasks.map(task => ({ ...task, estimateMinutes: Math.max(1, Math.round(task.estimateMinutes * ratio)) }));

export const pacedEstimate = async (
  root: string,
  tasks: readonly RunTask[],
  agentsAsked: number,
  takers: (role: string) => number
): Promise<Pick<PlanEstimate, 'paced'>> => {
  const history = await readHistory(root);

  return history
    ? { paced: { ...history, wallMinutes: estimate(atPace(tasks, history.ratio), agentsAsked, takers).wallMinutes } }
    : {};
};
