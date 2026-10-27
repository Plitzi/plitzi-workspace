import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { flowStages, nameOf } from './monitorFlow';
import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { logRun, openRun } from '../../runs/run';
import { completeTask, reviewTask } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { TaskLine } from '../../runs/view';
import type { Bench } from '../../tests/runProject';

/** Where the monitor says a task stands, and who is at it — as encore-10 showed it wrong, and how it reads now. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

/** Each card of a stage of the flow, as its id and who it is with. */
const cards = (tasks: readonly TaskLine[], key: string): string[] => {
  const stage = flowStages(tasks).find(each => each.key === key);

  return stage ? stage.tasks.map(task => `${nameOf(task)} ${stage.who(task)}`.trim()) : [];
};

describe('the monitor, as encore-10 read it', () => {
  // The lead read "working · last: started scout-1" while nobody led it: the keeper's start is no act of its.
  it('keeps the lead idle for an agent the run asked for and its keeper started', async () => {
    const runId = await open();
    bench.advance(3 * 60_000 + 1);
    await logRun(lead(), runPaths(bench.root, runId), { action: 'launch', agent: 'agent-1', asked: true });
    const row = (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'lead');
    expect(row).toMatchObject({ status: 'idle', doing: expect.not.stringContaining('started agent-1') as unknown });
  });

  // Its scope sat in a column of its own while its scout worked it, "At work" empty; then read "spike" while it waited.
  it('puts research where any card is: at work with its scout, or the lead with no scout; its result in review', async () => {
    const runId = await open();
    const base = (await monitorRun(lead(), runId)).view.tasks[0];
    const research = { ...base, spike: 'what the ask takes', agent: undefined };
    const cardsOf: TaskLine[] = [
      { ...research, id: 's-taken', status: 'in-progress', agent: 'scout-1' },
      { ...research, id: 's-lead', status: 'ready', leadFindsOut: true },
      { ...research, id: 's-proposed', status: 'in-review', proposed: { by: 'scout-1', tasks: ['t-x'] } }
    ];

    expect(cards(cardsOf, 'work')).toEqual(['s-lead lead', 's-taken scout-1']);
    expect(cards(cardsOf, 'ready')).toEqual([]);
    expect(cards(cardsOf, 'review')).toEqual(["s-proposed lead decides scout-1's"]);
  });

  // A task sent back read yellow in the strip and blue in its "At work" card: one task, two colours.
  it('draws a card in its task’s own colour, not its column’s', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await reviewTask(lead(), runId, 't-menu', 'changes', [{ note: 'Spanish prices' }]);

    const canvas = monitorScreen(
      await monitorRun(lead(), runId),
      { ...initialUi('advanced'), view: 'flow' },
      { width: 160, height: 48, now: bench.now(), theme: THEMES.dark, preview: { state: { kind: 'none' }, output: [] } }
    ).canvas;
    const at = canvas.text().findIndex(line => line.includes('t-menu ↺1'));
    const line = canvas.ansi(3)[at] ?? '';
    const before = line.slice(0, line.indexOf('t-menu'));
    const edge = before.slice(0, before.lastIndexOf('▎'));
    expect(edge.slice(edge.lastIndexOf('\x1b['))).toContain('38;2;251;191;36');
  });

  // dev-2, on demand, stopped for a fresh context after its card and read "restarting" two hours: nothing was left for it.
  it('says one on demand with nothing waiting at rest — one of the base restarting', async () => {
    await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 2, min: 1 }] });
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const paths = runPaths(bench.root, runId);
    const why = 'a piece ended: you are started again with a fresh context after each task or review — You can stop';
    await logRun(bench.agent('dev-1'), paths, { action: 'stops', why, fresh: true });
    await logRun(bench.agent('dev-2'), paths, { action: 'stops', why, fresh: true });
    const rows = (await monitorRun(lead(), runId)).agents;

    expect(rows.find(row => row.agent === 'dev-1')).toMatchObject({ status: 'restarting' });
    expect(rows.find(row => row.agent === 'dev-2')?.status).not.toBe('restarting');
    expect(rows.find(row => row.agent === 'dev-2')?.doing).toContain('on demand — started when work waits for it');
  });
});
