import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listedTasks } from './monitorBoard';
import { onKey, onMouse, QUIT_WARNING, splitInput } from './monitorInput';
import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../runs/monitor';
import { makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Need } from './monitorAttention';
import type { PaletteItem } from './monitorDialogs';
import type { Key, Shown, Step } from './monitorInput';
import type { MonitorUi } from './monitorModel';
import type { Monitored } from '../../runs/monitor';
import type { Bench } from '../../tests/runProject';

const NEEDS: Need[] = [
  { key: 'a', sort: 'review', person: false, said: 't-home waits for its review', fix: 'plitzi task review t-home' },
  { key: 'b', sort: 'asks', person: true, said: 'agent-2 asks which voice' }
];

const nothing = (more: Partial<Shown> = {}): Shown => ({
  hits: [],
  areas: [],
  needs: [],
  palette: () => [],
  preview: 'none',
  ...more
});

const press = (ui: MonitorUi, name: string, shown: Shown, more: Partial<Key> = {}): Step => {
  const step = onKey(ui, name.length === 1 ? name : undefined, { name, ...more }, shown);
  if (!step) {
    throw new Error(`${name} was read as no key`);
  }

  return step;
};

const typed = (ui: MonitorUi, text: string, shown: Shown): MonitorUi => {
  let at = ui;
  for (const char of text) {
    at = press(at, char, shown).ui;
  }

  return at;
};

describe("the monitor's keys and mouse", () => {
  it('quits on q — and, while it serves the preview, only on a second q, the first saying the preview stops too', () => {
    const ui = initialUi('advanced');
    expect(press(ui, 'q', nothing()).effects).toEqual([{ kind: 'quit' }]);

    const serving = nothing({ preview: 'serving' });
    const first = press(ui, 'q', serving);
    expect(first.effects).toEqual([]);
    expect(first.ui.flash).toBe(QUIT_WARNING);
    expect(press(first.ui, 'q', serving).effects).toEqual([{ kind: 'quit' }]);
    // ctrl+c is never asked twice.
    expect(press(ui, 'c', serving, { ctrl: true }).effects).toEqual([{ kind: 'quit' }]);
  });

  it('reads a mouse report or the terminal’s answer as no key', () => {
    expect(onKey(initialUi('advanced'), undefined, { sequence: '\x1b[<0;10;5M' }, nothing())).toBeUndefined();
    expect(onKey(initialUi('advanced'), undefined, { sequence: '\x1b]11;rgb:0/0/0' }, nothing())).toBeUndefined();
  });

  it('walks the notices: n the next, c copies its fix, esc puts it off, d shows them all', () => {
    const shown = nothing({ needs: NEEDS });
    const copied = press(initialUi('advanced'), 'c', shown);
    expect(copied.effects).toEqual([{ kind: 'copy', text: 'plitzi task review t-home' }]);
    expect(copied.ui.flash).toBe('copied: plitzi task review t-home');

    const next = press(initialUi('advanced'), 'n', shown).ui;
    expect(next.needsAt).toBe(1);
    // The second names no command: c copies nothing, and says nothing it did not do.
    expect(press(next, 'c', shown)).toEqual({ ui: next, effects: [] });

    const putOff = press(initialUi('advanced'), 'escape', shown).ui;
    expect([...putOff.dismissed]).toEqual(['a']);
    expect(press(initialUi('advanced'), 'd', shown).ui.dialog).toEqual({ kind: 'needs' });
  });

  it('switches views by their number, and closes a dialog on esc, ⏎ or ?', () => {
    const flow = press(initialUi('advanced'), '2', nothing()).ui;
    expect(flow.view).toBe('flow');
    const help = press(flow, '?', nothing()).ui;
    expect(help.dialog).toEqual({ kind: 'help' });
    expect(press(help, 'escape', nothing()).ui.dialog).toBeUndefined();
    // Under a dialog the board is not reached: a view's number, a notice's key, are no keys there.
    expect(press(help, '3', nothing()).ui).toEqual(help);
    expect(press(help, 'n', nothing({ needs: NEEDS })).ui).toEqual(help);
    // A task's dialog answers its own: another task, its id.
    const task: MonitorUi = { ...initialUi('advanced'), dialog: { kind: 'task' } };
    expect(press(task, 'p', nothing()).ui).toEqual(task);
  });

  it('asks the theme of the shell, and says why when p, x or o have nothing to do', () => {
    const ui = initialUi('advanced');
    expect(press(ui, 't', nothing()).effects).toEqual([{ kind: 'theme' }]);
    expect(press(ui, 'p', nothing())).toEqual({ ui: { ...ui, flash: 'no run to preview yet' }, effects: [] });
    expect(press(ui, 'x', nothing()).ui.flash).toBe('no preview is served — p starts one');
    expect(press(ui, 'o', nothing()).ui.flash).toBe('no preview is served — p starts one');
  });

  it('switches between simple and advanced with m, and turns advanced for a view asked by its number', () => {
    const simple = initialUi('simple');
    expect(press(simple, 'm', nothing()).ui.mode).toBe('advanced');
    expect(press(press(simple, 'm', nothing()).ui, 'm', nothing()).ui.mode).toBe('simple');
    expect(press(simple, '2', nothing()).ui).toMatchObject({ mode: 'advanced', view: 'flow' });
    // What only the advanced panel shows is not moved from the simple one.
    for (const name of ['down', 'return', 'left', 'a', 's', 'y']) {
      expect(press(simple, name, nothing()).ui).toEqual(simple);
    }

    // The notices and the preview are the simple panel's too.
    expect(press(simple, 'c', nothing({ needs: NEEDS })).effects).toEqual([
      { kind: 'copy', text: 'plitzi task review t-home' }
    ]);
  });

  it('types into the palette, runs what it picks and closes on esc', () => {
    const items: PaletteItem[] = [
      { group: 'View', label: 'Flow', hint: '2', action: { kind: 'view', view: 'flow' } },
      { group: 'Panel', label: 'Quit', hint: 'q', action: { kind: 'quit' } }
    ];
    const shown = nothing({ palette: () => items, preview: 'serving' });
    const open = press(initialUi('advanced'), 'p', shown, { ctrl: true }).ui;
    expect(open.dialog).toEqual({ kind: 'palette', query: '', at: 0 });

    const query = typed(open, 'fl', shown);
    expect(query.dialog).toEqual({ kind: 'palette', query: 'fl', at: 0 });
    // The letters a key of the panel answers are the palette's query while it is open.
    expect(press(query, 'q', shown).effects).toEqual([]);
    expect(press(query, 'backspace', shown).ui.dialog).toEqual({ kind: 'palette', query: 'f', at: 0 });

    const ran = press(open, 'return', shown).ui;
    expect(ran).toMatchObject({ view: 'flow', dialog: undefined });

    // Quit from the palette is the same quit: said first while the preview is served.
    const down = press(open, 'down', shown).ui;
    expect(press(down, 'return', shown).ui.flash).toBe(QUIT_WARNING);
    expect(press(open, 'escape', shown).ui.dialog).toBeUndefined();
  });

  describe('over a run', () => {
    let bench: Bench;

    beforeEach(async () => {
      bench = await makeBench();
    });

    afterEach(async () => {
      await bench.cleanup();
    });

    const { lead, open, take } = runSteps(() => bench);

    const over = (data: Monitored, ui: MonitorUi): Shown => {
      const screen = monitorScreen(data, ui, {
        width: 160,
        height: 48,
        now: bench.now(),
        theme: THEMES.dark,
        preview: { state: { kind: 'none' }, output: [] }
      });

      return {
        data,
        hits: screen.hits,
        areas: screen.areas,
        needs: screen.needs,
        palette: () => [],
        preview: 'none'
      };
    };

    it('picks a task with ↑↓ or a click, opens it with ⏎ or a second click, and copies its id with y', async () => {
      const runId = await open();
      await take('agent-1', 't-home');
      const data = await monitorRun(lead(), runId);
      const tasks = listedTasks(data.view.tasks, false);
      let ui = initialUi('advanced');

      ui = press(ui, 'down', over(data, ui)).ui;
      expect(ui.selected).toBe(1);
      ui = press(ui, 'up', over(data, ui)).ui;
      ui = press(ui, 'up', over(data, ui)).ui;
      // Up from the first wraps to the last.
      expect(ui.selected).toBe(tasks.length - 1);

      const copied = press(ui, 'y', over(data, ui));
      expect(copied.effects).toEqual([{ kind: 'copy', text: tasks.at(-1)?.id }]);
      expect(press(ui, 'return', over(data, ui)).ui.dialog).toEqual({ kind: 'task' });

      const second = over(data, initialUi('advanced')).hits.find(
        hit => hit.action.kind === 'task' && hit.action.index === 1
      );
      if (!second) {
        throw new Error('the sidebar lists a second task to click');
      }

      const click = { button: 0, row: second.row, col: second.from };
      const picked = onMouse(initialUi('advanced'), click, over(data, initialUi('advanced')));
      expect(picked?.selected).toBe(1);
      expect(picked && onMouse(picked, click, over(data, picked))?.dialog).toEqual({ kind: 'task' });
    });

    it('starts the preview on p and stops it on x — whoever serves it — saying so when there is nothing to do', async () => {
      const runId = await open();
      const data = await monitorRun(lead(), runId);
      const ui = initialUi('simple');
      const at = (preview: Shown['preview']): Shown => ({ ...over(data, ui), preview });

      expect(press(ui, 'p', at('none'))).toEqual({
        ui: { ...ui, flash: 'starting the preview…' },
        effects: [{ kind: 'start-preview' }]
      });
      expect(press(ui, 'p', at('elsewhere'))).toEqual({
        ui: { ...ui, flash: 'the preview is up already — x stops it' },
        effects: []
      });
      for (const preview of ['serving', 'elsewhere', 'starting'] as const) {
        expect(press(ui, 'x', at(preview)).effects).toEqual([{ kind: 'stop-preview' }]);
      }

      expect(press(ui, 'x', at('stopping')).effects).toEqual([]);
      expect(press(ui, 'p', at('stopping')).ui.flash).toBe('the preview is stopping — p again once it stopped');
      expect(press(ui, 'o', at('elsewhere')).effects).toEqual([{ kind: 'open-preview' }]);
    });

    it('scrolls what the wheel is over, and answers nothing it is not', async () => {
      const runId = await open();
      await take('agent-1', 't-home');
      const data = await monitorRun(lead(), runId);
      const ui = initialUi('advanced');
      const shown = over(data, ui);
      const activity = shown.areas.find(area => area.area.kind === 'activity');
      if (!activity) {
        throw new Error('the overview has an activity to scroll');
      }

      // The newest at the top: the wheel down scrolls to older events, up back to newer.
      const older = onMouse(ui, { button: 65, row: activity.top, col: activity.left }, shown);
      expect(older?.feedBack).toBe(1);
      expect(
        onMouse({ ...ui, feedBack: 1 }, { button: 64, row: activity.top, col: activity.left }, shown)?.feedBack
      ).toBe(0);
      // A click on no hit, and a wheel over nothing that scrolls, change nothing.
      expect(onMouse(ui, { button: 0, row: 47, col: 0 }, shown)).toBeUndefined();
      expect(onMouse(ui, { button: 64, row: 0, col: 0 }, shown)).toBeUndefined();
      // Under a dialog the board is not reached.
      expect(onMouse({ ...ui, dialog: { kind: 'help' } }, { button: 64, row: activity.top, col: 1 }, shown)).toBe(
        undefined
      );
    });
  });
});

describe('what the terminal sends', () => {
  // A click's report given to the keys whole was read as 1, 2, 5: views switched and the panel turned advanced.
  it('takes a click’s report and the terminal’s answer out of the keys', () => {
    expect(splitInput('\x1b[<0;12;5M\x1b[<0;12;5m')).toEqual({
      mice: [
        { button: 0, column: 12, row: 5, pressed: true },
        { button: 0, column: 12, row: 5, pressed: false }
      ],
      keys: ''
    });
    expect(splitInput('\x1b]11;rgb:1111/1111/1111\x1b\\q').keys).toBe('q');
    expect(splitInput('\x1b]11;rgb:ffff/ffff/ffff\x07').keys).toBe('');
    expect(splitInput('m\x1b[<64;3;4M2')).toEqual({
      mice: [{ button: 64, column: 3, row: 4, pressed: true }],
      keys: 'm2'
    });
  });
});
