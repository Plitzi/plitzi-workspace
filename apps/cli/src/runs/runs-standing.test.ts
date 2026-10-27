import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leadItems } from './leadWatch';
import { messagesOf } from './messages';
import { openRun, loadRun } from './run';
import { messageTasks, tellLead, tellLeadAbout } from './talk';
import { reportProgress, takeNext } from './tasks';
import { viewRun } from './view';
import { SCOUT, team, TESTERS } from '../tests/reviewerSteps';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

/**
 * A task that takes long wakes the lead, which asks where it stands; its agent answers whole — how far, how long still,
 * what is done, left and holding it — and the lead decides on it (Carlos).
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, take } = runSteps(() => bench);

const STANDING = { fraction: 0.6, etaMinutes: 10, done: 'The hero in Spanish', left: 'The footer links' };

describe('a task past the work limit', () => {
  it('wakes the lead to ask — again at each limit more — and the answer, whole, is its to decide on', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    await reportProgress(home.ctx, runId, 't-home', { step: 'the hero' });

    // Past the 10 min a piece of work takes before something is usually wrong (Carlos), whatever it was estimated.
    bench.advance(11 * 60_000);
    const woken = async () => leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('long-task:'));
    expect((await woken()).map(item => item.key)).toEqual(['long-task:t-home:x1']);
    expect((await woken())[0]?.text).toContain('agent-1 last said: "the hero"');
    expect((await woken())[0]?.text).toContain('plitzi task message @agent-1 --standing');
    bench.advance(10 * 60_000);
    expect((await woken()).map(item => item.key)).toEqual(['long-task:t-home:x2']);

    const [asked] = await messageTasks(lead(), runId, '@agent-1', '', undefined, true);
    expect(asked).toMatchObject({
      asksStanding: true,
      text: expect.stringContaining('task tell --standing') as unknown
    });
    expect((await refusal(tellLead(home.ctx, runId, 't-home', '', { ...STANDING, done: '' }))).message).toContain(
      'A standing is said whole: --done says what is done'
    );

    const told = await tellLead(home.ctx, runId, 't-home', '', STANDING);
    expect(told).toMatchObject({ replyTo: asked.id, standing: STANDING, fyi: true });
    const said = (await viewRun(lead(), runId)).attention.find(item => item.message === told.id);
    expect(said?.text).toContain(
      't-home stands at 60 % · ~10 min left — done: The hero in Spanish; left: The footer links'
    );
    expect(said?.text).toContain('decide: let it go on');
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-home')).toMatchObject({ fraction: 0.6 });
  });

  it('wakes the lead for a spike its scout takes long at, the scout answering by name', async () => {
    await bench.writeTeam(team(SCOUT));
    const plan: RunPlan = benchPlan();
    plan.tasks = [
      ...plan.tasks,
      { ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words' }
    ];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');

    bench.advance(41 * 60_000);
    const item = leadItems(await viewRun(lead(), runId)).find(each => each.key.startsWith('long-task:s-words'));
    expect(item?.text).toContain('plitzi task message @scout-1 --standing');

    const [asked] = await messageTasks(lead(), runId, '@scout-1', '', undefined, true);
    const told = await tellLeadAbout(bench.agent('scout-1'), runId, 's-words', '', STANDING);
    expect(told).toMatchObject({ replyTo: asked.id, about: 's-words' });
    expect((await messagesOf(await loadRun(lead(), runId))).find(each => each.id === told.id)?.text).toContain(
      'On s-words: 60 %'
    );
  });
});
