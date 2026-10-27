import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leadItems, waitForLead } from './leadWatch';
import { messagesOf } from './messages';
import { runPaths } from './paths';
import { openRun, loadRun } from './run';
import { askLead, messageTasks, tellLead, tellLeadAbout, unheardOf } from './talk';
import { reportProgress, takeNext } from './tasks';
import { viewRun } from './view';
import { ranAs } from '../tests/ranAs';
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

  // Two research cards ran 39 and 26 min, their lead woken for each and asking neither.
  it('asks the agent itself, the lead woken with its answer — or, with none in time, to decide without it', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    bench.advance(11 * 60_000);

    const woke = await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
    expect(woke.fresh.some(item => item.key.startsWith('long-task:'))).toBe(false);
    const asked = (await messagesOf(await loadRun(lead(), runId))).filter(message => message.asksStanding === true);
    expect(asked.map(message => message.to)).toEqual(['@agent-1']);

    await tellLead(home.ctx, runId, 't-home', '', STANDING);
    const answered = await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
    // It wakes the lead — never kept as a note for the watch's end.
    expect(answered.timedOut).toBeUndefined();
    expect(answered.fresh.map(item => item.text)).toContainEqual(expect.stringContaining('t-home stands at 60 %'));
    expect(answered.fresh.some(item => item.key.startsWith('long-task:'))).toBe(false);

    // The next limit: asked again, and no answer within the grace — the lead decides without it.
    bench.advance(10 * 60_000);
    await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
    bench.advance(4 * 60_000);
    const unanswered = leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('long-task:'));
    expect(unanswered.map(item => item.key)).toEqual(['long-task:t-home:x2:unanswered']);
    expect(unanswered[0]?.text).toContain('no answer in 4 min — agent-1 is at something long of its own');
  });
});

describe('the run asking where a card stands', () => {
  // A card whose rounded minutes reached its limit half a minute before the clock did was asked 77 times: every pass of
  // the watch and the keeper read the asking as from before the limit, and asked again.
  it('asks once a limit, whatever passes of the watch come after', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    await take('agent-1', 't-home');
    const asks = async () =>
      (await messagesOf(await loadRun(lead(), runId))).filter(message => message.asksStanding === true).length;
    const passes = async (count: number) => {
      for (let pass = 0; pass < count; pass += 1) {
        await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
        bench.advance(5000);
      }
    };

    // 9.6 minutes reads 10 rounded: not past the limit yet.
    bench.advance(9.6 * 60_000);
    await passes(4);
    expect(await asks()).toBe(0);

    bench.advance(30_000);
    await passes(6);
    expect(await asks()).toBe(1);
  });
});

describe('a message to an agent at something long of its own', () => {
  it('tells the lead it is heard only when that ends', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    // Its last command of the run, as the CLI keeps it.
    const command = 'plitzi task progress';
    const line = {
      at: bench.now().toISOString(),
      by: 'agent-1',
      command,
      ...ranAs(command),
      chars: 10,
      ms: 5,
      code: 0
    };
    await fs.appendFile(path.join(runPaths(bench.root, runId).dir, 'usage.jsonl'), `${JSON.stringify(line)}\n`);
    const sent = await messageTasks(lead(), runId, 't-home', 'Keep the hero');
    expect(await unheardOf(lead(), runId, sent, bench.now())).toEqual([]);

    bench.advance(5 * 60_000);
    expect(await unheardOf(lead(), runId, sent, bench.now())).toEqual([{ to: 't-home', agent: 'agent-1', minutes: 5 }]);

    // Waiting inside an ask it follows, it hears the answer at once: never said to hear it late.
    await askLead(home.ctx, runId, 't-home', 'Formal or informal?');
    bench.advance(3 * 60_000);
    expect(await unheardOf(lead(), runId, sent, bench.now())).toEqual([]);
  });
});
