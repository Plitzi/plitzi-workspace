import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { emergencyRows, runEmergency } from './monitorEmergency';
import { onKey } from './monitorInput';
import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { setTeamAgent } from '../../../core/team';
import { loadRun, openRun } from '../../../runs/run';
import { monitorRun } from '../../../runs/view/monitor';
import { benchPlan, makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { Shown, Step } from './monitorInput';
import type { MonitorUi } from './monitorModel';
import type { Monitored } from '../../../runs/view/monitor';
import type { Bench } from '../../../tests/runProject';

// "en el monitor hay que tener un panel de emergencia… pausar todo o reanudar todo, tumbar agentes".
let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

const shownOf = (data: Monitored): Shown => ({
  data,
  hits: [],
  areas: [],
  needs: [],
  palette: () => [],
  preview: 'none'
});

const press = (ui: MonitorUi, name: string, shown: Shown): Step => {
  const step = onKey(ui, name.length === 1 ? name : undefined, { name }, shown);
  if (!step) {
    throw new Error(`${name} was read as no key`);
  }

  return step;
};

const screenText = (data: Monitored, ui: MonitorUi): string =>
  monitorScreen(data, ui, {
    width: 160,
    height: 48,
    now: bench.now(),
    theme: THEMES.dark,
    preview: { state: { kind: 'none' }, output: [] }
  })
    .canvas.text()
    .join('\n');

describe('the emergency panel', () => {
  it('pauses the run, stops and holds agents and lets them start — what stops work only at a second ⏎', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    let data = await monitorRun(lead(), 'es-launch');
    expect(emergencyRows(data).map(row => row.label)).toEqual([
      'Pause the run — the tasks in hand finish and go to review, none starts',
      'Stop every agent now and hold them — what they hold stays in their hands, their copies as they are',
      'dev-1 · hold it',
      'design-1 · hold it'
    ]);

    // `!` opens it; ⏎ on the pause arms it, a second ⏎ asks it.
    const open = press(initialUi('simple'), '!', shownOf(data)).ui;
    expect(open.dialog).toEqual({ kind: 'emergency', at: 0 });
    expect(screenText(data, open)).toContain('Emergency');
    const armed = press(open, 'return', shownOf(data));
    expect(armed.effects).toEqual([]);
    expect(armed.ui.dialog).toEqual({ kind: 'emergency', at: 0, armed: 0 });
    expect(press(armed.ui, 'return', shownOf(data)).effects).toEqual([
      { kind: 'emergency', action: { kind: 'pause' } }
    ]);
    // Moving off an armed row disarms it: a ⏎ on another row arms that one.
    const moved = press(armed.ui, 'down', shownOf(data)).ui;
    expect(press(moved, 'return', shownOf(data)).effects).toEqual([]);

    // Done as the commands do it: the run paused, dev-1 held — and the panel offers what undoes each.
    expect(await runEmergency(lead(), 'es-launch', { kind: 'pause' })).toContain('paused');
    expect(await runEmergency(lead(), 'es-launch', { kind: 'hold', agent: 'dev-1' })).toBe(
      'stopped and held: dev-1 — the run starts them no more until allowed'
    );
    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('stopping');
    data = await monitorRun(lead(), 'es-launch');
    const rows = emergencyRows(data);
    expect(rows.map(row => row.label)).toEqual([
      'Resume the run — it is stopping: tasks can be taken, the keeper starts the agents',
      'Let every held agent start again — dev-1',
      'Stop every agent now and hold them — what they hold stays in their hands, their copies as they are',
      'dev-1 · allow it',
      'design-1 · hold it'
    ]);
    expect(rows[3].about).toContain('held by lead');
    expect(screenText(data, { ...open, dialog: { kind: 'emergency', at: 0 } })).toContain(
      'The run is stopping · 1 held — the run starts none of them'
    );
    // Undoing asks no confirmation: one ⏎.
    expect(press({ ...open, dialog: { kind: 'emergency', at: 1 } }, 'return', shownOf(data)).effects).toEqual([
      { kind: 'emergency', action: { kind: 'allow' } }
    ]);
    expect(await runEmergency(lead(), 'es-launch', { kind: 'allow' })).toContain('allowed: dev-1');
    expect(await runEmergency(lead(), 'es-launch', { kind: 'resume' })).toContain('resumed');
    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('open');

    // esc closes it.
    expect(press(open, 'escape', shownOf(data)).ui.dialog).toBeUndefined();
  }, 30_000);
});
