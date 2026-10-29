import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listedTasks } from './monitorBoard';
import { followedNext, onKey, onMouse, QUIT_WARNING, splitInput } from './monitorInput';
import { initialUi, keptBack } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../../runs/view/monitor';
import { makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { Need } from './monitorAttention';
import type { PaletteItem } from './monitorDialogs';
import type { Key, Shown, Step } from './monitorInput';
import type { MonitorUi } from './monitorModel';
import type { Monitored } from '../../../runs/view/monitor';
import type { Bench } from '../../../tests/runProject';

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

    // The team could be changed from the panel, and nothing on the screen said so: the person looked and found no way.
    it('says r on the status bar and under the agents, where a click opens the team as r does', async () => {
      const runId = await open();
      const data = await monitorRun(lead(), runId);
      const ui = { ...initialUi('advanced'), view: 'agents' as const };
      const screen = monitorScreen(data, ui, {
        width: 160,
        height: 48,
        now: bench.now(),
        theme: THEMES.dark,
        preview: { state: { kind: 'none' }, output: [] }
      });
      const rows = screen.canvas.text();

      expect(rows.at(-1)).toContain('r team');
      expect(rows.some(row => row.includes('the team — more or fewer of a role'))).toBe(true);

      const hint = over(data, ui).hits.find(hit => hit.action.kind === 'team');
      if (!hint) {
        throw new Error('the agents view has the team to click');
      }

      expect(onMouse(ui, { button: 0, row: hint.row, col: hint.from }, over(data, ui))?.dialog).toEqual({
        kind: 'team',
        at: 0
      });
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

// Carlos: a headless agent's stream, seen in the sidebar under the spend once an agent of the list is picked.
describe('the agent whose stream is followed', () => {
  it('is the next one at each w — none past the last — and the one clicked, a click on it again none', () => {
    const agents = ['dev-1', 'scout-1'];
    const first = followedNext(initialUi('advanced'), agents);
    expect(first.agent).toBe('dev-1');
    expect(followedNext(first, agents).agent).toBe('scout-1');
    expect(followedNext({ ...first, agent: 'scout-1' }, agents).agent).toBeUndefined();

    const shown = nothing({ hits: [{ row: 9, from: 0, to: 40, action: { kind: 'agent', agent: 'scout-1' } }] });
    const picked = onMouse(initialUi('advanced'), { button: 0, row: 9, col: 3 }, shown);
    expect(picked?.agent).toBe('scout-1');
    expect(picked && onMouse(picked, { button: 0, row: 9, col: 3 }, shown)?.agent).toBeUndefined();
  });

  // Carlos: the stream could not be scrolled, and the sidebar was too narrow to read it — the newest at the top since,
  // as the activity reads, so the wheel down goes to earlier moments.
  it('is scrolled back by the wheel over it — never past its first moment, nor past the live end — and e widens the sidebar', () => {
    const over = nothing({ areas: [{ area: { kind: 'stream', most: 2 }, top: 10, left: 0, width: 40, height: 5 }] });
    const followed = { ...initialUi('advanced'), agent: 'dev-1' };
    const up = (ui: MonitorUi) => onMouse(ui, { button: 64, row: 12, col: 3 }, over) ?? ui;
    const down = (ui: MonitorUi) => onMouse(ui, { button: 65, row: 12, col: 3 }, over) ?? ui;

    expect(down(followed).streamBack).toBe(1);
    expect(down(down(down(followed))).streamBack).toBe(2);
    expect(up(down(followed)).streamBack).toBe(0);
    expect(up(followed).streamBack).toBe(0);
    // Another agent followed starts at its live end.
    expect(followedNext({ ...followed, streamBack: 2 }, ['dev-1', 'scout-1']).streamBack).toBe(0);

    const wide = press(followed, 'e', nothing()).ui;
    expect(wide.sideWide).toBe(true);
    expect(press(wide, 'e', nothing()).ui.sideWide).toBe(false);
  });
});

describe('a stream scrolled back as moments come', () => {
  const moment = (text: string) => ({ at: text, kind: 'said' as const, text });

  it('stays on what it was reading — back by as many as came after — and live, it stays live', () => {
    const before = ['a', 'b', 'c'].map(moment);
    const after = ['b', 'c', 'd', 'e'].map(moment);

    expect(keptBack(before, after, 1)).toBe(3);
    expect(keptBack(before, after, 0)).toBe(0);
    expect(keptBack(before, ['x', 'y'].map(moment), 1)).toBe(1);
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

// The person watching a run set the team's size in another terminal: the panel raises and lowers it.
describe("the monitor's team", () => {
  const withTeam = nothing({
    data: {
      view: { tasks: [] },
      feed: [],
      team: [
        { name: 'dev', roles: ['developer'], count: 2, min: 2 },
        { name: 'test', roles: ['tester'], count: 1, min: 0 }
      ]
    } as unknown as Monitored // The team alone: nothing else of a run is read by these keys.
  });

  it('opens on r, moves with ↑ ↓, and asks one more or one fewer of the entry chosen — its min no more than its count', () => {
    const open = press(initialUi('simple'), 'r', withTeam).ui;
    expect(open.dialog).toEqual({ kind: 'team', at: 0 });

    expect(press(open, '+', withTeam).effects).toEqual([{ kind: 'team-count', name: 'dev', count: 3 }]);
    expect(press(open, '-', withTeam).effects).toEqual([{ kind: 'team-count', name: 'dev', count: 1, min: 1 }]);

    const tester = press(open, 'down', withTeam).ui;
    expect(tester.dialog).toEqual({ kind: 'team', at: 1 });
    const none = press(tester, '-', withTeam);
    expect(none.effects).toEqual([]);
    expect(none.ui.flash).toContain('test is one already');
    expect(press(tester, 'escape', withTeam).ui.dialog).toBeUndefined();
  });

  it('says so when the team names no agent', () => {
    const empty = nothing({ data: { view: { tasks: [] }, feed: [], team: [] } as unknown as Monitored });
    expect(press(initialUi('simple'), 'r', empty).ui.flash).toContain('the team names no agent');
  });
});
