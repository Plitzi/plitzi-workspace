import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { leadItems } from './leadWatch';
import { messagesOf } from './messages';
import { monitorRun } from './monitor';
import { loadRun, openRun } from './run';
import { askLead, messageTasks, noteRun } from './talk';
import { completeTask, followNext, reassignTask, reviewTask, takeNext } from './tasks';
import { coLeadNames, leadCount, setTeamAgent } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Team } from './team';
import type { Bench } from '../tests/runProject';

/** Leads beside the lead: one for every four agents, reviewing from one queue — and nothing that is the lead's. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, take } = runSteps(() => bench);

const team = (agents: number, count?: number): Team => ({
  version: 1,
  ...(count === undefined ? {} : { lead: { count } }),
  agents: [{ name: 'agent', roles: ['developer'], count: agents }]
});

/** A run of four agents and three leads, as its team says, with t-menu, then t-home, sent to review. */
const twoInReview = async (): Promise<{ runId: string; menu: Awaited<ReturnType<typeof take>> }> => {
  const plan = { ...benchPlan(), designReview: false };
  const file = await bench.writePlan(plan);
  await bench.writeTeam({ ...teamFor(plan, 4), lead: { count: 3 } });
  const { runId } = (await openRun(lead(), file)).checked;
  const menu = await take('agent-1', 't-menu');
  await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
  await completeTask(menu.ctx, runId, 't-menu');
  const home = await take('agent-2', 't-home');
  await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = { title: "Inicio" };\n');
  await completeTask(home.ctx, runId, 't-home');

  return { runId, menu };
};

describe('how many leads', () => {
  it('is one for every four agents, or as many as the team says', async () => {
    expect(leadCount(team(2))).toBe(1);
    expect(leadCount(team(4))).toBe(1);
    expect(leadCount(team(5))).toBe(2);
    expect(coLeadNames(team(9))).toEqual(['lead-2', 'lead-3']);
    expect(coLeadNames(team(9, 1))).toEqual([]);

    await bench.writeTeam(team(5));
    expect(await setTeamAgent(bench.root, 'lead', { count: 1 })).toMatchObject({ after: { count: 1 } });
    expect(await setTeamAgent(bench.root, 'lead', { model: 'claude-opus-5-5' })).toMatchObject({
      after: { count: 1, model: 'claude-opus-5-5' }
    });
    expect((await refusal(setTeamAgent(bench.root, 'lead', { count: 9 }))).message).toContain('1 to 8');
  });

  it('records the leads that review when the run opens', async () => {
    const { runId } = await twoInReview();
    expect((await viewRun(lead(), runId)).leads).toEqual(['lead-2', 'lead-3']);
  });
});

describe('a review, taken from one queue', () => {
  it('offers each lead a review no other took, and holds it to the one that took it', async () => {
    const { runId } = await twoInReview();
    const first = (await takeNext(bench.agent('lead-2'), runId, 'lead')).next.leadReview?.task.id ?? '';
    const second = (await takeNext(bench.agent('lead-3'), runId, 'lead')).next.leadReview?.task.id ?? '';
    expect([first, second].sort()).toEqual(['t-home', 't-menu']);

    const claimed = await refusal(reviewTask(bench.agent('lead-3'), runId, first, 'approve', []));
    expect(claimed.code).toBe('claimed');
    expect(claimed.message).toContain(`lead-2 reviews ${first}`);

    expect(await reviewTask(bench.agent('lead-2'), runId, first, 'approve', [])).toMatchObject({ verdict: 'approve' });
    // The lead has the last word on any: the one lead-3 took included.
    expect(await reviewTask(lead(), runId, second, 'approve', [])).toMatchObject({ verdict: 'approve' });
  });

  it('gives the same lead the next round of a review it sent back', async () => {
    const { runId, menu } = await twoInReview();
    await reviewTask(bench.agent('lead-2'), runId, 't-menu', 'changes', [{ note: 'The title says nothing' }]);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "La carta" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    // t-home waited longer now, but lead-2 knows what it asked of t-menu.
    const next = await takeNext(bench.agent('lead-2'), runId, 'lead');
    expect(next.next.leadReview).toMatchObject({ task: { id: 't-menu' }, round: 1 });
    expect(next.next.leadReview?.asked.join(' ')).toContain('The title says nothing');
    expect(next.next.leadReview?.copy).toBe(menu.work);

    // A second round: its notes whole, the first round's counted — never every review again, whole.
    await reviewTask(bench.agent('lead-2'), runId, 't-menu', 'changes', [{ note: 'Now say the season' }]);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "La carta de otoño" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    const again = await takeNext(bench.agent('lead-2'), runId, 'lead');
    expect(again.next.leadReview).toMatchObject({ round: 2, earlier: 1 });
    expect(again.next.leadReview?.asked).toEqual([expect.stringContaining('Now say the season')]);
  });

  it('serialises two verdicts on one task: the second reads it said', async () => {
    const { runId } = await twoInReview();
    const both = await Promise.allSettled([
      reviewTask(lead(), runId, 't-menu', 'approve', []),
      reviewTask(bench.agent('lead-2'), runId, 't-menu', 'approve', [])
    ]);
    expect(both.filter(each => each.status === 'fulfilled')).toHaveLength(1);
    const lost = both.find(each => each.status === 'rejected');
    expect(String(lost?.status === 'rejected' ? lost.reason : '')).toContain(
      'is approved already: there is no review to say'
    );
  });

  it('says why there is none, and that it can stop once every task is done', async () => {
    const { runId } = await twoInReview();
    await takeNext(bench.agent('lead-2'), runId, 'lead');
    await takeNext(bench.agent('lead-3'), runId, 'lead');
    const none = await takeNext(bench.agent('lead-4'), runId, 'lead').catch((error: unknown) => error);
    expect(String(none)).toContain('no lead of this run');

    const waiting = await takeNext(lead(), runId, 'lead');
    expect(waiting.next.why).toMatch(/t-(home|menu) is lead-2's, t-(home|menu) is lead-3's/);
    expect(waiting.next.finished).toBeUndefined();
  });
});

describe('what stays the lead’s', () => {
  it('refuses a lead that reviews the plan, the notes and a reassignment', async () => {
    const { runId } = await twoInReview();
    const file = await bench.writePlan({ ...benchPlan(), designReview: false });
    // One at a time, each awaited as it starts: begun together, a refusal not yet awaited went unhandled.
    for (const work of [
      () => amendRun(bench.agent('lead-2'), runId, file),
      () => noteRun(bench.agent('lead-2'), runId, 'Use the formal voice'),
      () => reassignTask(bench.agent('lead-2'), runId, 't-book')
    ]) {
      const refused = await refusal(work());
      expect(refused.code).toBe('lead-only');
    }
  });

  it('refuses an agent of the team a lead’s verdict, without its task’s token too', async () => {
    const { runId } = await twoInReview();
    const refused = await refusal(reviewTask(bench.agent('agent-3'), runId, 't-menu', 'approve', []));
    expect(refused.code).toBe('lead-only');
    expect(refused.message).toContain('lead, lead-2, lead-3');
  });
});

describe('the lead, woken for a review', () => {
  it('only once one waited two minutes with no lead taking it', async () => {
    const { runId } = await twoInReview();
    const taken = (await takeNext(bench.agent('lead-2'), runId, 'lead')).next.leadReview?.task.id;
    const untaken = taken === 't-menu' ? 't-home' : 't-menu';
    const view = await viewRun(lead(), runId);
    const since = Date.parse(view.tasks.find(task => task.id === untaken)?.since ?? '');
    expect(leadItems(view, new Date(since + 60_000)).filter(item => item.key.startsWith('review:'))).toEqual([]);

    const late = leadItems(view, new Date(since + 3 * 60_000)).filter(item => item.key.startsWith('review:'));
    // The one lead-2 took is its: only the one nobody took.
    expect(late.map(item => item.key)).toEqual([expect.stringContaining(`review:${untaken}:`)]);
    expect(late[0]?.text).toContain('no one took it');
  });
});

/** A tester reviews the code before the tests it writes: its approval is the task's, and the lead is not woken for it. */
describe('a tester, reviewing the code', () => {
  it('takes the review the lead would, and approves the task', async () => {
    const plan = { ...benchPlan(), designReview: false };
    const file = await bench.writePlan(plan);
    await bench.writeTeam({
      version: 1,
      agents: [
        { name: 'agent', roles: ['developer'], count: 2 },
        { name: 'test', roles: ['tester'] }
      ]
    });
    const { runId } = (await openRun(lead(), file)).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const offered = await takeNext(bench.agent('test-1'), runId, 'tester');
    expect(offered.next.leadReview?.task.id).toBe('t-menu');
    const view = await viewRun(lead(), runId);
    expect(view.reviewers).toContain('test-1');
    expect(leadItems(view, new Date()).filter(item => item.key.startsWith('review:'))).toEqual([]);

    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu')?.status).toBe('done');
  });
});

describe('a lead that reviews, started when the reviews queue up', () => {
  it('leaves every review to the lead while none runs, and says to start one once two waited five minutes', async () => {
    const { runId } = await twoInReview();
    const view = await viewRun(lead(), runId);
    expect(view.askingLeads).toEqual([]);
    const since = Math.max(...view.tasks.map(task => Date.parse(task.since ?? view.openedAt)));
    // At once: both reviews are the lead's, and nobody else is asked for.
    expect(leadItems(view, new Date(since + 1000)).map(item => item.key.split(':')[0])).toEqual(['review', 'review']);

    const late = leadItems(view, new Date(since + 6 * 60_000));
    expect(late[0]?.key.startsWith('leads-needed:')).toBe(true);
    expect(late[0]?.text).toContain('plitzi task next --role lead --follow --take --agent lead-2');
  });

  it('is running while it asks, and is told to stop once nothing came for a while', async () => {
    const { runId } = await twoInReview();
    const first = (await takeNext(bench.agent('lead-2'), runId, 'lead')).next.leadReview?.task.id ?? '';
    const second = (await takeNext(bench.agent('lead-3'), runId, 'lead')).next.leadReview?.task.id ?? '';
    expect((await viewRun(lead(), runId)).askingLeads).toEqual(['lead-2', 'lead-3']);
    await reviewTask(bench.agent('lead-2'), runId, first, 'approve', []);
    await reviewTask(bench.agent('lead-3'), runId, second, 'approve', []);

    const idle = await followNext(bench.agent('lead-2'), runId, 'lead', { timeoutMs: 60_000, everyMs: 1, idleMs: 0 });
    expect(idle).toMatchObject({ finished: true });
    expect(idle.why).toContain('You can stop');
  });

  // velada-dress: lead-2 waited through the run's last task and its integration, the lead there for both.
  it('stops at once when what is left is for the other leads — no review waiting', async () => {
    const { runId } = await twoInReview();
    const first = (await takeNext(bench.agent('lead-2'), runId, 'lead')).next.leadReview?.task.id ?? '';
    await reviewTask(bench.agent('lead-2'), runId, first, 'approve', []);
    // One review still waits: not spare yet.
    expect(
      (await followNext(bench.agent('lead-2'), runId, 'lead', { timeoutMs: 0, everyMs: 1, idleMs: 60_000 })).finished
    ).not.toBe(true);
    const second = (await takeNext(bench.agent('lead-3'), runId, 'lead')).next.leadReview?.task.id ?? '';
    await reviewTask(bench.agent('lead-3'), runId, second, 'approve', []);

    const spare = await followNext(bench.agent('lead-2'), runId, 'lead', {
      timeoutMs: 60_000,
      everyMs: 1,
      idleMs: 60_000
    });
    expect(spare).toMatchObject({ finished: true });
    expect(spare.why).toContain('2 tasks left (t-book, t-about) for 2 other leads');
  });
});

// velada-dress: the agents waited a median 7.8 minutes for the lead's answers, lead-2 idle beside it.
describe('a question to the lead, answered by a lead that reviews', () => {
  it('is handed to one lead that reviews when no review waits, the lead told what it said — and woken only if it waits', async () => {
    const { runId } = await twoInReview();
    await reviewTask(lead(), runId, 't-menu', 'approve', []);
    await reviewTask(lead(), runId, 't-home', 'approve', []);
    const about = await take('agent-3', 't-about');
    const asked = await askLead(about.ctx, runId, 't-about', 'Is "Sobre nosotros" the title, or "Quiénes somos"?');

    const handed = await takeNext(bench.agent('lead-2'), runId, 'lead');
    expect(handed.next.question).toMatchObject({ id: asked.question.id, task: 't-about', agent: 'agent-3' });
    expect((await takeNext(bench.agent('lead-3'), runId, 'lead')).next.question).toBeUndefined();
    // Taken, it is lead-2's: the lead is not woken for it while lead-2 is at it.
    expect((await viewRun(lead(), runId)).attention.some(item => item.text.includes(asked.question.id))).toBe(false);
    expect((await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'lead-2')).toMatchObject({
      status: 'working',
      task: 't-about'
    });

    await messageTasks(bench.agent('lead-2'), runId, 't-about', '"Quiénes somos", as the original', asked.question.id);
    const told = (await messagesOf(await loadRun(lead(), runId))).find(each => each.to === 'lead' && each.fyi === true);
    expect(told?.text).toContain(`lead-2 answered t-about's ${asked.question.id}: "Quiénes somos", as the original`);
  });

  it('wakes the lead for a question a lead that reviews took and left unanswered', async () => {
    const { runId } = await twoInReview();
    await reviewTask(lead(), runId, 't-menu', 'approve', []);
    await reviewTask(lead(), runId, 't-home', 'approve', []);
    const about = await take('agent-3', 't-about');
    const asked = await askLead(about.ctx, runId, 't-about', 'Spanish or Catalan?');
    await takeNext(bench.agent('lead-2'), runId, 'lead');
    bench.advance(3 * 60_000);

    expect((await viewRun(lead(), runId)).attention).toContainEqual(
      expect.objectContaining({
        kind: 'message',
        text: expect.stringContaining(
          `(${asked.question.id}): Spanish or Catalan? — lead-2 took it and has not answered`
        ) as unknown
      })
    );
  });
});

describe('the lead, beside a lead that reviews one', () => {
  it('is not woken for a review another lead took, and counts that lead as running', async () => {
    const { runId } = await twoInReview();
    const taken = (await takeNext(bench.agent('lead-2'), runId, 'lead')).next.leadReview?.task.id;
    // Asked a while ago: it is reviewing, not asking.
    bench.advance(5 * 60_000);
    const view = await viewRun(lead(), runId);
    expect(view.askingLeads).toEqual([]);
    const keys = leadItems(view, bench.now()).map(item => item.key);
    expect(keys.some(key => key.startsWith(`review:${String(taken)}:`))).toBe(false);
    expect(keys.some(key => key.startsWith('leads-needed:'))).toBe(false);
  });
});
