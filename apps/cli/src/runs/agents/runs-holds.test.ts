import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { allowAgents, holdAgents } from './holdAgents';
import { keepOnce } from './keeper';
import { setTeamAgent } from './team';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { isRunRefusal } from '../core/refusal';
import { openRun } from '../run';
import { viewRun } from '../view/view';

import type { StartAgent } from './keeper';
import type { Bench } from '../../tests/runProject';

// The person — and the lead — stop agents and let them start again, and the run never starts one held.
let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

const started: string[] = [];
const start: StartAgent = agent => {
  started.push(agent);

  return Promise.resolve('started');
};

describe('agents held and allowed', () => {
  it('holds an agent the run would start until it is allowed — the lead’s or a person’s, never a teammate’s', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const teamFile = path.join(bench.root, '.plitzi', 'team.json');
    const team = JSON.parse(await fs.readFile(teamFile, 'utf-8')) as Record<string, unknown>;
    await fs.writeFile(teamFile, JSON.stringify({ ...team, options: { launch: 'claude' } }));
    await openRun(lead(), await bench.writePlan(benchPlan()));

    const refused = await holdAgents(bench.agent('design-1'), 'es-launch', ['dev-1']).catch((error: unknown) => error);
    expect(isRunRefusal(refused) && refused.code).toBe('lead-only');

    expect(await holdAgents(lead(), 'es-launch', ['dev-1'])).toEqual({
      held: [{ agent: 'dev-1', ended: false, holds: [] }],
      already: []
    });
    expect(await holdAgents(lead(), 'es-launch', ['dev-1'])).toMatchObject({ held: [], already: ['dev-1'] });

    started.length = 0;
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: ['design-1'], failed: [] });
    const view = await viewRun(lead(), 'es-launch');
    expect(view.held['dev-1']).toContain('held by lead');
    expect(view.attention.find(item => item.kind === 'start-held')?.text).toContain(
      'dev-1 stopped by lead (run hold): the run starts it no more until allowed — plitzi run allow dev-1'
    );

    const allowed = await allowAgents(lead(), 'es-launch', []);
    expect(allowed.allowed.map(each => [each.agent, each.why])).toEqual([['dev-1', 'stopped']]);
    started.length = 0;
    const kept = await keepOnce(lead(), 'es-launch', start);
    expect('started' in kept && kept.started).toContain('dev-1');
    expect(await allowAgents(lead(), 'es-launch', ['design-1'])).toEqual({ allowed: [], notHeld: ['design-1'] });

    const unknown = await holdAgents(lead(), 'es-launch', ['dev-9']).catch((error: unknown) => error);
    expect(isRunRefusal(unknown) && unknown.message).toContain('dev-9: no agent of the team');
  }, 30_000);
});
