import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../../runs/view/monitor';
import { benchPlan, makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { Monitored } from '../../../runs/view/monitor';
import type { Bench } from '../../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { doTask, lead, open, take } = runSteps(() => bench);

/** The head's strip — its fourth row — as a terminal this wide draws it. */
const strip = (data: Monitored, width = 160): string =>
  monitorScreen(data, initialUi('advanced'), {
    width,
    height: 48,
    now: bench.now(),
    theme: THEMES.dark,
    preview: { state: { kind: 'none' }, output: [] }
  }).canvas.text()[3];

describe('the strip at the head of run monitor', () => {
  // Fifty tasks drew a row of `◎…` blocks that named none of them: a block a task only when every block says its id.
  it('says the strip by stage when the width holds no whole id for each task', async () => {
    const runId = await open(benchPlan());
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await take('agent-2', 't-home');
    const data = await monitorRun(lead(), runId);

    const wide = strip(data);
    expect(wide).toContain('◐ t-home');

    // Ids a run names them by, longer than a block of the width: its stages instead.
    const named = {
      ...data,
      view: { ...data.view, tasks: data.view.tasks.map(task => ({ ...task, id: `${task.id}-with-its-whole-name` })) }
    };
    const narrow = strip(named, 64);
    expect(narrow).toContain('✓ 1 approved');
    expect(narrow).toContain('◐ 1 at work');
    expect(narrow).toContain('○ 1 ready');
    expect(narrow).toContain('○ 1 pending');
    expect(narrow).not.toMatch(/[◐○◎↺■−]…/);

    // Narrower than the stages' words: each its mark and count, none cut off the end.
    const narrower = strip(data, 40);
    expect(narrower.trim().split(/\s{2,}/)).toEqual(['✓ 1 approved', '◐ 1', '○ 1', '○ 1']);
  });
});
