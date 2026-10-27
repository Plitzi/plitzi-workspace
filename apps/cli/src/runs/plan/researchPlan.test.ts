import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backlogOfPlan, BACKLOG_FILE } from './backlog';
import { startLines } from '../../commands/runs/run/plan';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { checkPlanFile } from '../run';

import type { Bench } from '../../tests/runProject';
import type { Team } from '../agents/team';
import type { PlannedTask, RunPlan } from '../core/model';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

const card = (id: string, spike: string, findings?: string): PlannedTask => ({
  id,
  title: `Find out ${id}`,
  files: [],
  dependsOn: [],
  priority: 'medium',
  estimateMinutes: 10,
  acceptance: ['Proposes the tasks'],
  spike,
  ...(findings ? { findings } : {})
});

/** a run's open: three research cards, a team of one developer and one scout. */
const researchAlone = (): RunPlan => ({
  ...benchPlan(),
  tasks: [
    card('s-player', 'How the Player recovers', 'From the backlog (b-1): no onReady in 30 s'),
    card('s-plate', 'The plate’s empty slot (b-2)'),
    card('s-claps', 'Claps, live')
  ]
});

describe('a plan of research alone', () => {
  it('is worked as its scouts allow, asks for no inventory, and keeps the base for the tasks it brings', async () => {
    const team: Team = {
      version: 1,
      agents: [
        { name: 'dev', roles: ['developer'], count: 1 },
        { name: 'scout', roles: ['scout'], count: 1, min: 0 }
      ]
    };
    await bench.writeTeam(team);
    const checked = await checkPlanFile(lead(), await bench.writePlan(researchAlone()));

    expect(checked.estimate.agents).toBe(1);
    expect(checked.notices.filter(notice => notice.startsWith('No inventory'))).toEqual([]);
    const lines = startLines(checked.tasks, team).map(line => stripVTControlCharacters(line));
    expect(lines).toContainEqual(expect.stringContaining('dev-1 — developer — '));
    expect(lines).toContainEqual(expect.stringContaining('(the tasks its research brings)'));
    expect(lines.some(line => line.includes('leave it out'))).toBe(false);
  });

  it('takes up the backlog items its cards name: their tasks close them', async () => {
    const item = (id: string) => ({
      id,
      text: `Item ${id}`,
      from: 'run-14',
      by: 'lead',
      at: '2026-10-27T10:00:00Z'
    });
    await bench.write(BACKLOG_FILE, JSON.stringify({ version: 1, items: [item('b-1'), item('b-2'), item('b-3')] }));

    const backlog = await backlogOfPlan(bench.root, researchAlone().tasks);

    expect(backlog.researched.map(each => [each.item.id, each.task])).toEqual([
      ['b-1', 's-player'],
      ['b-2', 's-plate']
    ]);
    expect(backlog.untaken.map(each => each.id)).toEqual(['b-3']);
  });
});
