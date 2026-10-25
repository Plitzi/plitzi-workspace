import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listedTasks } from './monitorBoard';
import { createCanvas } from './monitorCanvas';
import { flowStages, nameOf } from './monitorFlow';
import { initialUi } from './monitorModel';
import { shimmer } from './monitorOverview';
import { monitorScreen, waitingScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { extendRun } from '../../runs/extend';
import { groupRepeats, monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { logRun, stopRun } from '../../runs/run';
import { askLead, messageTasks, noteRun, tellLead } from '../../runs/talk';
import { completeTask, followNext, reportProgress, reviewTask } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { MonitorUi, PreviewShown } from './monitorModel';
import type { Screen } from './monitorScreen';
import type { RunPlan } from '../../runs/model';
import type { FeedLine, Monitored } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';
import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { doTask, lead, open, take } = runSteps(() => bench);

const NO_PREVIEW: PreviewShown = { state: { kind: 'none' }, output: [] };

/** The panel drawn as a person's terminal would, at its size: its screen and its plain text, a row a line. */
const shown = (
  data: Monitored,
  ui: Partial<MonitorUi> = {},
  { width = 160, height = 48, preview = NO_PREVIEW }: { width?: number; height?: number; preview?: PreviewShown } = {}
): { screen: Screen; text: string[] } => {
  const screen = monitorScreen(
    data,
    { ...initialUi('advanced'), ...ui },
    { width, height, now: bench.now(), theme: THEMES.dark, preview }
  );

  return { screen, text: screen.canvas.text() };
};

/** Each card of a stage of the flow, as its id and who it is with. */
const cards = (tasks: readonly TaskLine[], key: string): string[] => {
  const stage = flowStages(tasks).find(each => each.key === key);

  return stage ? stage.tasks.map(task => `${nameOf(task)} ${stage.who(task)}`.trim()) : [];
};

/** How many tasks each stage of the flow holds, by its key. */
const counts = (tasks: readonly TaskLine[]): Record<string, number> =>
  Object.fromEntries(flowStages(tasks).map(stage => [stage.key, stage.tasks.length]));

describe('plitzi run monitor', () => {
  it('says only what a person acts on when simple: who is at what, the tasks by stage, the preview, the latest', async () => {
    const runId = await open();
    const home = await take('agent-2', 't-home');
    await tellLead(home.ctx, runId, 't-home', 'The hero image is missing alt text');
    const data = await monitorRun(lead(), runId);
    const advanced = shown(data).text;
    const { text } = shown(data, { mode: 'simple' });
    const all = text.join('\n');

    expect(text[0]).toContain(runId);
    expect(text[1]).toMatch(/━+\s+0 of \d+ approved · 0%/);
    for (const title of ['Working now', 'Tasks', 'Preview', 'Latest']) {
      expect(all).toContain(title);
    }

    expect(all).toMatch(/agent-2\s+Writing… t-home/);
    expect(all).toContain('p start');
    // No views, no spend, no model: the advanced panel's — one key away, said in the status bar.
    expect(advanced.join('\n')).toContain('Overview');
    expect(all).not.toContain('Overview');
    expect(all).not.toContain('Spend');
    expect(text.at(-1)).toMatch(/m advanced/);
    // What is the lead's to act on is counted, not shown: the box is the person's alone.
    expect(advanced.join('\n')).toContain('For the lead');
    expect(all).not.toContain('For the lead');
    expect(text.at(-1)).toMatch(/\d+ for the lead/);
  });

  // Every state read the same grey, and working the green of what is approved.
  it("draws each agent's state in its tone — working in the accent", async () => {
    const runId = await open();
    await take('agent-2', 't-home');
    const { screen, text } = shown(await monitorRun(lead(), runId));
    const row = text.findIndex(line => line.includes('on t-home'));
    expect(row).toBeGreaterThan(0);
    const ansi = screen.canvas.ansi(3)[row] ?? '';
    const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(THEMES.dark.primary.slice(at, at + 2), 16));
    expect(ansi).toMatch(new RegExp(`38;2;${String(r)};${String(g)};${String(b)}[;0-9]*mon t-home`));
  });

  // Every live verb shimmered in the accent: Writing, Asking and Restarting read alike.
  it('shimmers each live verb in the tone of its state', () => {
    const rgb = (hex: string) => [1, 3, 5].map(at => String(Number.parseInt(hex.slice(at, at + 2), 16))).join(';');
    const verb = (word: string, tone: 'primary' | 'warning' | 'info') => {
      const canvas = createCanvas(20, 1, THEMES.dark);
      // A frame whose sweep is past the word: every letter in the state's tone.
      shimmer(
        { canvas, theme: THEMES.dark, hues: new Map(), now: bench.now(), hits: [], areas: [] },
        0,
        0,
        word,
        14,
        tone
      );

      return canvas.ansi(3)[0] ?? '';
    };
    expect(verb('Writing…', 'primary')).toContain(`38;2;${rgb(THEMES.dark.primary)}`);
    expect(verb('Asking…', 'warning')).toContain(`38;2;${rgb(THEMES.dark.warning)}`);
    expect(verb('Asking…', 'warning')).not.toContain(`38;2;${rgb(THEMES.dark.primary)}`);
    expect(verb('Restarting…', 'info')).toContain(`38;2;${rgb(THEMES.dark.info)}`);
  });

  it('waits for a run in a frame of its own, its head and its foot as ever, every edge the same width', () => {
    const said =
      'Run "es-launch" is gone: it finished, or a person aborted it. The panel shows the next one the moment it opens.';
    const text = waitingScreen(
      { title: 'Run ended', said, tone: 'primary' },
      { width: 100, height: 24, now: bench.now(), theme: THEMES.dark }
    ).text();
    expect(text[0]).toMatch(/^ {2}◆ plitzi\s+\d\d:\d\d UTC {2}$/);
    const top = text.findIndex(line => line.includes('╭─ Run ended '));
    const bottom = text.findIndex(line => line.includes('╰'));
    expect(top).toBeGreaterThan(0);
    expect(text[top]?.trimEnd().length).toBe(text[bottom]?.trimEnd().length);
    // Said whole, in lines that fit the frame.
    expect(text.slice(top, bottom).join(' ').replace(/[│ ]+/g, ' ')).toContain('it finished, or a person aborted it.');
    expect(text.at(-1)).toMatch(/^ plitzi .*q quit {2}$/);
    // A key with nothing to do here says so, as on the board.
    const pressed = waitingScreen(
      { title: 'No run yet', said: 'This project has no run of agents.', tone: 'primary' },
      { width: 100, height: 24, now: bench.now(), theme: THEMES.dark, flash: 'no run to preview yet' }
    ).text();
    expect(pressed.at(-1)).toContain('no run to preview yet');
  });

  it('shows the run on top, its activity told as it happened, its tasks and agents beside', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(about.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-about', 'approve', []);
    await take('agent-2', 't-home');
    await messageTasks(lead(), runId, 't-home', 'Use the formal voice');

    const { text } = shown(await monitorRun(lead(), runId));

    // Opened on a plan written before it: said, never a silently missing spike column.
    expect(text[0]).toMatch(new RegExp(`◆ plitzi\\s+${runId}\\s+scoped before the run`));
    expect(text[0]).toContain('● OPEN');
    expect(text[1]).toMatch(/1 Overview\s+2 Flow\s+3 Tasks\s+4 Agents\s+5 Spend/);
    expect(text[1]).toContain('1 of 4 approved · 25%');
    // The strip: every task a block, the approved first.
    expect(text[3].indexOf('✓ t-about')).toBeLessThan(text[3].indexOf('◐ t-home'));
    // The transcript: who, the task, what — a message's words quoted.
    expect(text.some(line => /● lead\s+t-about\s+approved/.test(line))).toBe(true);
    expect(text.some(line => /● lead → agent-2\s+t-home\s+“Use the formal voice”/.test(line))).toBe(true);
    // The sidebar: the tasks left, the approved said in a line, each agent where it stands.
    expect(text.some(line => line.includes('✓ 1 approved · a lists them'))).toBe(true);
    expect(text.some(line => /● agent-2\s+harness\s+on t-home/.test(line))).toBe(true);
    // Of the team, never started: not idle — nothing of it has run.
    expect(text.some(line => /· agent-3\s+harness\s+not started/.test(line))).toBe(true);
  });

  it('lists the work first, the approved after it — the latest approval first — and its time against its estimate', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await take('agent-2', 't-home');

    const data = await monitorRun(lead(), runId);
    expect(data.stories['t-about']).toMatchObject({ writers: ['agent-1'], approvedBy: 'lead', sentBack: 0 });
    const ids = listedTasks(data.view.tasks, true).map(task => task.id);
    expect(ids[0]).toBe('t-home');
    expect(ids.at(-1)).toBe('t-about');
    const { text } = shown(data, { view: 'tasks', showApproved: true });
    // Urgent at a glance: t-home is high — its mark beside it; the approved one struck through, its time against its
    // estimate.
    expect(text.some(line => /^▎! ◐ at work\s+t-home\s+agent-2/.test(line))).toBe(true);
    expect(text.some(line => /✓ approved\s+t-about\s+agent-1\s+.*\d+m \/ \d+m/.test(line))).toBe(true);

    const done = (id: string, at: string): TaskLine => ({ ...data.view.tasks[0], id, status: 'done', updatedAt: at });
    expect(
      listedTasks([done('t-first', '2026-10-25T01:00:00.000Z'), done('t-last', '2026-10-25T03:00:00.000Z')], true).map(
        task => task.id
      )
    ).toEqual(['t-last', 't-first']);
  });

  it('scrolls the activity back, the newest last, and says how far', async () => {
    const runId = await open();
    for (const text of Array.from({ length: 40 }, (_, index) => String(index + 1))) {
      await noteRun(lead(), runId, `Note ${text}`);
      bench.advance(1000);
    }

    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    const latest = shown(data, {}, { height: 40 }).text;
    const head = latest.find(line => line.includes('Activity')) ?? '';
    expect(head).toMatch(/\d+ events · ← \d+ older/);
    const notes = latest.filter(line => line.includes('“Note'));
    expect(notes.at(-1)).toContain('“Note 40”');

    const back = shown(data, { feedBack: 10 }, { height: 40 }).text;
    expect(back.find(line => line.includes('Activity'))).toContain('→ 10 newer');
    expect(back.filter(line => line.includes('“Note')).at(-1)).toContain('“Note 30”');
  });

  it('says a task held on a question to the lead, on its row, in the flow and as what needs the lead — until it is answered', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');

    const held = await monitorRun(lead(), runId);
    expect(cards(held.view.tasks, 'held')).toContain(`t-home asks lead (${asked.question.id})`);
    const { screen, text } = shown(held, { view: 'tasks' });
    expect(text.some(line => line.includes(`agent-1 asks the lead (${asked.question.id})`))).toBe(true);
    expect(screen.needs.some(need => need.sort === 'question' && need.task === 't-home')).toBe(true);
    expect(text.some(line => line.includes('question (t-home)') || /▲ question\s+t-home/.test(line))).toBe(true);

    // Answered, it waits for its agent to have the answer — no longer asking.
    await messageTasks(lead(), runId, 't-home', 'Spanish', asked.question.id);
    const answered = await monitorRun(lead(), runId);
    expect(cards(answered.view.tasks, 'held')).toContain(`t-home answered (${asked.question.id})`);
    expect(
      shown(answered, { view: 'tasks' }).text.some(line =>
        line.includes(`agent-1 has its answer (${asked.question.id})`)
      )
    ).toBe(true);
  });

  it('says an event repeated in a row once, how many times and since when — and opens it where clicked', async () => {
    const refused = (at: string, message: string): FeedLine => ({
      at,
      by: 'lead',
      kind: 'problem',
      text: `refused (checks-failed): plitzi run finish — ${message}`,
      group: 'refused:checks-failed:plitzi run finish'
    });
    const grouped = groupRepeats([
      refused('2026-10-21T10:03:00.000Z', 't-boxers-list'),
      refused('2026-10-21T10:01:00.000Z', 't-pages'),
      refused('2026-10-21T09:58:00.000Z', 't-boxers-list'),
      { at: '2026-10-21T09:50:00.000Z', by: 'dev-1', kind: 'take', text: 'took t-morph', task: 't-morph' }
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ count: 3, since: '2026-10-21T09:58:00.000Z' });

    const runId = await open();
    await noteRun(lead(), runId, 'The CDN is slow');
    await noteRun(lead(), runId, 'The CDN is slow');
    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    const folded = shown(data);
    const row = folded.text.findIndex(line => line.includes('“The CDN is slow” ×2 since'));
    expect(folded.text[row]?.startsWith('▸')).toBe(true);
    const hit = folded.screen.hits.find(each => each.row === row && each.action.kind === 'event');
    if (hit?.action.kind !== 'event') {
      throw new Error('no line to click');
    }

    const opened = shown(data, { opened: new Set([hit.action.key]) }).text;
    expect(opened.some(line => line.startsWith('▾') && line.includes('×2'))).toBe(true);
    expect(opened.filter(line => line.includes('⎿') && line.includes('“The CDN is slow”'))).toHaveLength(1);
  });

  // The lead took a review whose UI waited for a designer, said "reviewing", and its card read "nobody yet".
  it('puts a review the lead took in the lead’s column, named, though its UI waits for a designer', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    const { tasks } = (await monitorRun(lead(), runId)).view;
    const due = (reviewer?: string) =>
      tasks.map(task =>
        task.id === 't-menu' ? { ...task, design: { status: 'due' as const, round: 0 }, reviewer } : task
      );

    expect(counts(due())).toMatchObject({ 'ui-review': 1, 'lead-review': 0 });
    expect(cards(due(), 'ui-review')).toEqual(['t-menu waiting']);
    expect(counts(due('lead'))).toMatchObject({ 'ui-review': 0, 'lead-review': 1 });
    expect(cards(due('lead'), 'lead-review')).toEqual(['t-menu lead']);
  });

  it('draws the run as a flow, each task in its stage, the review split, and one sent back at work again', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const home = await take('agent-2', 't-home');
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const first = (await monitorRun(lead(), runId)).view.tasks;
    expect(counts(first)).toEqual({
      pending: 1,
      ready: 0,
      work: 1,
      held: 0,
      'ui-review': 0,
      'lead-review': 1,
      approved: 1
    });
    expect(cards(first, 'work')).toEqual(['t-home agent-2']);
    expect(cards(first, 'lead-review')).toEqual(['t-menu waiting']);

    // A question to the lead holds its agent: the task is held, saying why, and no longer at work.
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');
    const held = await monitorRun(lead(), runId);
    expect(counts(held.view.tasks)).toMatchObject({ work: 0, held: 1 });
    // The lead's row says what waits on it, not idle (dev-3 kept waiting, the lead "idle").
    expect(held.agents.find(agent => agent.agent === 'lead')?.doing).toBe(
      `1 question waits for you: t-home's ${asked.question.id}`
    );

    // Sent to review with the question still open, it stands in review alone: a task is in one column at a time.
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await completeTask(home.ctx, runId, 't-home');
    expect(counts((await monitorRun(lead(), runId)).view.tasks)).toMatchObject({ held: 0, 'lead-review': 2 });

    // Sent back by the lead: at work again, its agent's — never "ready", free to take — marked with its round.
    await reviewTask(lead(), runId, 't-menu', 'changes', [{ note: 'Spanish prices' }]);
    const back = (await monitorRun(lead(), runId)).view.tasks;
    expect(counts(back)).toMatchObject({ ready: 0, work: 1 });
    expect(cards(back, 'work')).toEqual(['t-menu ↺1 agent-3']);

    // The whole board, view 2: every stage, its count and its cards.
    const board = shown(await monitorRun(lead(), runId), { view: 'flow' }).text;
    for (const title of ['Pending', 'Ready', 'At work', 'Held', 'UI review', 'Lead review', 'Approved']) {
      expect(
        board.some(line => line.includes(title)),
        title
      ).toBe(true);
    }

    expect(board.some(line => line.includes('t-menu ↺1'))).toBe(true);
  });

  // The lead answered t-fights, and nothing on the board moved until dev-1 had completed it — an answer is
  // taken up by its agent, and that is what puts the task at work again.
  it('holds an answered task until its agent has the answer, then says it goes on', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');
    await messageTasks(lead(), runId, 't-home', 'Spanish', asked.question.id);

    expect(cards((await monitorRun(lead(), runId)).view.tasks, 'held')).toContain(
      `t-home answered (${asked.question.id})`
    );

    await reportProgress(home.ctx, runId, 't-home', { step: 'the hero' });
    const { view, feed } = await monitorRun(lead(), runId);
    expect(cards(view.tasks, 'work')).toContain('t-home agent-1');
    expect(feed.map(line => `${line.task ?? ''} ${line.text}`)).toContainEqual(
      `t-home goes on — ${asked.question.id} answered`
    );
  });

  // Dev-2 stood "ready" with t-home, sent back, and "at work" with t-overlay at once — one agent, two
  // cards, and no telling which it was at.
  it('shows an agent at one task at a time: the one it last worked on, the others held for it', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    bench.advance(60_000);
    await take('agent-1', 't-menu');
    bench.advance(60_000);
    await reportProgress(home.ctx, runId, 't-home', { step: 'the hero' });

    const { view, agents } = await monitorRun(lead(), runId);
    expect(counts(view.tasks)).toMatchObject({ work: 1, held: 1 });
    expect(cards(view.tasks, 'work')).toEqual(['t-home agent-1']);
    expect(cards(view.tasks, 'held')).toEqual(['t-menu agent-1 at t-home']);
    expect(agents.find(agent => agent.agent === 'agent-1')).toMatchObject({
      task: 't-home',
      doing: expect.stringContaining('also holds t-menu (in-progress)') as unknown
    });
  });

  it('says an agent between tasks is gone once nothing marked it present for a while', async () => {
    const runId = await open();
    await take('agent-1', 't-home');
    await take('agent-2', 't-menu');
    await take('agent-3', 't-about');
    await followNext(bench.agent('agent-4'), runId, 'developer', { timeoutMs: 30, everyMs: 10 });
    const row = async () => (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'agent-4');

    expect((await row())?.status).toBe('idle');
    bench.advance(3 * 60_000);
    expect(await row()).toMatchObject({
      status: 'no-signal',
      doing: expect.stringContaining('no sign of it for 3 min') as unknown
    });
  });

  it('shows the lead working while its commands come, and idle once they stop', async () => {
    const runId = await open();
    await logRun(lead(), runPaths(bench.root, runId), { action: 'launch', agent: 'agent-1', harness: 'claude' });
    const row = async () => (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'lead');

    expect(await row()).toMatchObject({
      status: 'working',
      doing: expect.stringContaining('started agent-1 in claude') as unknown
    });
    bench.advance(3 * 60_000 + 1);
    expect((await row())?.status).toBe('idle');
  });

  it('says an agent joined though its scratch was there first, and a wait by its reason alone', async () => {
    const runId = await open();
    await fs.mkdir(path.join(runPaths(bench.root, runId).dir, 'scratch', 'agent-4'), { recursive: true });
    await take('agent-1', 't-home');
    await followNext(bench.agent('agent-4'), runId, 'developer', { timeoutMs: 0, everyMs: 10 });
    const { feed } = await monitorRun(lead(), runId);
    expect(feed.some(line => line.by === 'agent-4' && line.text.includes('joined'))).toBe(true);
    const wait = feed.find(line => line.by === 'agent-4' && line.text.startsWith('waits for work'));
    expect(wait?.text.length ?? 0).toBeLessThan(80);
  });

  it('keeps an agent waiting through a stopped run present, its row saying what it waits for', async () => {
    const runId = await open();
    await stopRun(lead(), runId, false, 'the brake');
    bench.advance(3 * 60_000);
    await followNext(bench.agent('agent-4'), runId, 'developer', { timeoutMs: 30, everyMs: 10 });
    expect((await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'agent-4')).toMatchObject({
      status: 'idle',
      doing: expect.stringContaining('waits for the run to go on — it is stopping') as unknown
    });
  });

  it('shows an agent whose task waits for its review as idle, the task its reviewer’s', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const agent = (await monitorRun(lead(), runId)).agents.find(each => each.agent === 'agent-3');
    expect([agent?.status, agent?.doing, agent?.task]).toEqual([
      'idle',
      expect.stringContaining('t-menu: sent it to review') as unknown,
      undefined
    ]);
  });

  it('says an agent waiting for its first task in a few words, not the list of every task', async () => {
    const runId = await open();
    await take('agent-3', 't-menu');
    await logRun(bench.agent('agent-4'), runPaths(bench.root, runId), {
      action: 'waiting',
      why: 'nothing is ready: t-menu in-progress (agent-3), t-home pending (waits for t-menu), t-about pending (waits for t-menu)'
    });

    const agent = (await monitorRun(lead(), runId)).agents.find(each => each.agent === 'agent-4');
    // Idle: a wait for work is no work — the line says what it waits for.
    expect([agent?.status, agent?.doing]).toEqual([
      'idle',
      expect.stringMatching(/^waiting for its first task — 1 at work/)
    ]);
    expect(agent?.doing).not.toContain('t-home');
  });

  it('says a completion and its note on one line, and a tell said later apart', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await tellLead(menu.ctx, runId, 't-menu', 'Prices in euros, two decimals');
    bench.advance(60_000);
    await tellLead(menu.ctx, runId, 't-menu', 'One more thing');

    const feed = (await monitorRun(lead(), runId)).feed.filter(line => line.task === 't-menu');
    expect(feed.find(line => line.kind === 'complete')?.text).toBe(
      'sent it to review — “Prices in euros, two decimals”'
    );
    expect(feed.filter(line => line.kind === 'message').map(line => line.quote)).toEqual(['One more thing']);
  });

  // A long plan is scrolled through, not laid out whole; a stage with more cards than it shows, by the wheel over it.
  it('scrolls a long list of tasks to the one chosen, and a stage of the flow by the wheel', async () => {
    const plan = benchPlan();
    plan.tasks = Array.from({ length: 30 }, (_, index) => ({
      id: `t-page-${String(index + 1)}`,
      title: `Page ${String(index + 1)}`,
      files: [`src/space/pages/p${String(index + 1)}.ts`],
      dependsOn: [],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: []
    }));
    const runId = await open(plan);
    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);

    const first = shown(data).text;
    expect(first.some(line => line.includes('t-page-1 '))).toBe(true);
    expect(first.some(line => line.includes('t-page-30 '))).toBe(false);
    expect(first.some(line => /1–\d+ of 30/.test(line))).toBe(true);
    expect(shown(data, { selected: 29 }).text.some(line => line.includes('t-page-30 '))).toBe(true);

    const board = shown(data, { view: 'flow' });
    expect(board.screen.areas.some(each => each.area.kind === 'stage' && each.area.key === 'ready')).toBe(true);
    expect(board.text.some(line => /\+\d+ more/.test(line))).toBe(true);
    const scrolled = shown(data, { view: 'flow', flowOffsets: new Map([['ready', 5]]) }).text;
    expect(scrolled.some(line => line.includes('↑ 5'))).toBe(true);
    expect(scrolled.some(line => / t-page-6(\s|$)/.test(line))).toBe(true);
    expect(scrolled.some(line => / t-page-1(\s|$)/.test(line))).toBe(false);
  });

  // T-motion sat pending while the three it followed waited for one designer — nothing on screen said so.
  it('says what a pending task waits for, and where each of those stands, on its row and in the flow', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, runId, 't-home');
    const data = await monitorRun(lead(), runId);
    const waiting = data.view.tasks.find(task => task.status === 'pending' && task.waitsOn?.includes('t-home'));
    if (!waiting) {
      throw new Error('the bench plan has a task after t-home');
    }

    expect(
      shown(data, { view: 'tasks' }).text.some(
        line => line.includes(waiting.id) && line.includes('after t-home (lead review)')
      )
    ).toBe(true);
    expect(cards(data.view.tasks, 'pending').some(card => card.startsWith(`${waiting.id} after t-home`))).toBe(true);
  });

  // A run with stages stacked on it says the one at work: its head named the first goal alone.
  it('says the stage a run is at, and its goal', async () => {
    const runId = await open();
    const stage: RunPlan = {
      version: 1,
      runId: 'es-contact',
      goal: 'A contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'A contact page',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'medium',
          estimateMinutes: 10,
          acceptance: ['The form is there']
        }
      ]
    };
    await extendRun(lead(), runId, await bench.writePlan(stage));

    const data = await monitorRun(lead(), runId);
    expect(data.stage).toEqual({ name: 'es-contact', goal: 'A contact page', of: 2 });
    expect(shown(data).text[0]).toMatch(/stage 2 · es-contact\s+.*A contact page/);
  });

  // Not every terminal is a wide monitor: the panel fits each — the sidebar beside the activity from 130 columns, its
  // parts their own views under — and never a line past the width.
  it('fits every terminal, from a laptop pane to a wide monitor, every view', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    await take('agent-2', 't-home');
    for (const text of Array.from({ length: 20 }, (_, index) => `Note ${String(index + 1)}`)) {
      await noteRun(lead(), runId, text);
    }

    const data = await monitorRun(lead(), runId);
    for (const [width, height] of [
      [60, 20],
      [80, 24],
      [100, 30],
      [120, 40],
      [160, 50],
      [220, 60]
    ] as const) {
      for (const view of ['overview', 'flow', 'tasks', 'agents', 'spend'] as const) {
        const { text } = shown(data, { view }, { width, height });
        const at = `${String(width)}×${String(height)} ${view}`;
        expect(text, at).toHaveLength(height);
        expect(
          text.every(line => line.length <= width),
          at
        ).toBe(true);
        expect(text.at(-1), at).toContain(runId);
      }

      const overview = shown(data, {}, { width, height }).text;
      expect(
        overview.some(line => line.includes('Activity')),
        String(width)
      ).toBe(true);
      expect(
        overview.some(line => line.includes('Tasks 4')),
        String(width)
      ).toBe(width >= 130);
    }
  });

  it('serves the preview from the panel and shows what its server says under its address', async () => {
    const data = await monitorRun(lead(), await open());
    const preview: PreviewShown = {
      state: { kind: 'serving', url: 'http://127.0.0.1:8300' },
      output: ['ready in 312ms', 'GET / 200 in 41ms']
    };
    for (const width of [160, 100]) {
      const { text } = shown(data, {}, { width, preview });
      const row = text.findIndex(line => line.includes('Preview') && line.includes('http://127.0.0.1:8300'));
      expect(row, String(width)).toBeGreaterThan(0);
      expect(text[row + 1], String(width)).toContain('ready in 312ms');
      expect(text[row + 2], String(width)).toContain('GET / 200 in 41ms');
      expect(text.at(-1), String(width)).toContain('preview :8300');
    }

    const stopped = shown(
      data,
      {},
      {
        preview: { state: { kind: 'stopped', why: 'the server stopped (1)', said: ['Error: port in use'] }, output: [] }
      }
    ).text;
    expect(stopped.some(line => line.includes('the server stopped (1)'))).toBe(true);
    expect(stopped.some(line => line.includes('Error: port in use'))).toBe(true);
  });

  it('asks what needs someone one notice at a time, the fix it names a key away, and puts one off', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    await tellLead(home.ctx, runId, 't-home', 'The hero image has no alt text');
    const data = await monitorRun(lead(), runId);
    const { screen, text } = shown(data);
    expect(screen.needs.length).toBeGreaterThan(0);
    const top = text.findIndex(line => line.includes('For the lead') || line.includes('Needs you'));
    expect(top).toBeGreaterThan(0);
    // Every edge of its frame the same width.
    const edges = [top, top + 4].map(row => text[row]?.trimEnd() ?? '');
    expect(edges[0].length).toBe(edges[1].length);
    expect(text[top + 3]).toContain('details');
    const first = screen.needs.at(0);
    if (!first) {
      throw new Error('a run just opened has a notice');
    }

    expect(shown(data, { dismissed: new Set([first.key]) }).screen.needs.map(need => need.key)).not.toContain(
      first.key
    );
    expect(
      shown(data, { dialog: { kind: 'needs' } }).text.some(line =>
        line.includes(`Needs · ${String(screen.needs.length)}`)
      )
    ).toBe(true);
  });

  it('opens a task whole over the board, its story under it', async () => {
    const runId = await open();
    const home = await take('agent-2', 't-home');
    await reportProgress(home.ctx, runId, 't-home', { step: 'the hero' });
    await messageTasks(lead(), runId, 't-home', 'Use the formal voice');
    const data = await monitorRun(lead(), runId);
    const selected = listedTasks(data.view.tasks, false).findIndex(task => task.id === 't-home');

    const { screen, text } = shown(data, { selected, dialog: { kind: 'task' } });
    expect(text.some(line => line.includes('◐ t-home'))).toBe(true);
    expect(text.some(line => line.includes('now: the hero'))).toBe(true);
    expect(text.some(line => line.includes('Its story'))).toBe(true);
    expect(text.some(line => line.includes('“Use the formal voice”'))).toBe(true);
    // Over the board, nothing under it answers a click.
    expect(screen.hits).toEqual([]);
  });

  it('finds a task, an agent or a fix from the palette as it is typed', async () => {
    const data = await monitorRun(lead(), await open());
    const { text } = shown(data, { dialog: { kind: 'palette', query: 'thome', at: 0 } });
    const row = text.findIndex(line => line.includes('Commands'));
    expect(text.slice(row, row + 8).some(line => line.includes('▎') && line.includes('t-home'))).toBe(true);
    expect(
      shown(data, { dialog: { kind: 'palette', query: 'zzzz', at: 0 } }).text.some(line =>
        line.includes('Nothing is called "zzzz"')
      )
    ).toBe(true);
  });
});
