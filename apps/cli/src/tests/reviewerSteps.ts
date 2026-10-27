import { benchPlan, writeInCopy } from './runProject';
import { runSteps } from './runSteps';
import { openRun } from '../runs/run';
import { completeTask } from '../runs/tasks';

import type { Bench } from './runProject';
import type { Team, TeamAgent } from '../runs/agents/team';
import type { RunPlan } from '../runs/core/model';

/** Scripted agents, each one session the test drives: a fresh start between pieces has tests of its own. */
export const scripted = (agent: TeamAgent): TeamAgent => ({ ...agent, session: 'keep' });

/** Two agents that develop and design, and the members a test adds: testers, a scout. */
export const team = (...more: TeamAgent[]): Team => ({
  version: 1,
  agents: [scripted({ name: 'agent', roles: ['developer', 'designer'], count: 2 }), ...more.map(scripted)]
});

export const TESTERS = { name: 'test', roles: ['tester'], count: 2 };
export const SCOUT = { name: 'scout', roles: ['scout'] };

/** The steps a run reviewed by testers is tested with. */
export const reviewerSteps = (bench: () => Bench) => {
  const { lead, take } = runSteps(bench);

  /** A run of the bench's plan — no UI review — with t-menu, then t-home, sent to review. */
  const twoInReview = async (members: Team = team(TESTERS)): Promise<{ runId: string }> => {
    const plan: RunPlan = benchPlan();
    const file = await bench().writePlan(plan);
    await bench().writeTeam(members);
    const { runId } = (await openRun(lead(), file)).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    const home = await take('agent-2', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = { title: "Inicio" };\n');
    await completeTask(home.ctx, runId, 't-home');

    return { runId };
  };

  return { twoInReview };
};
