import { listedTasks } from './monitorBoard';
import { VIEWS } from './monitorModel';
import { SPEND_SORTS } from './monitorSpend';

import type { Need } from './monitorAttention';
import type { PaletteAction, PaletteItem } from './monitorDialogs';
import type { Area, Dialog, Hit, MonitorUi } from './monitorModel';
import type { PreviewState } from './monitorPreview';
import type { Monitored } from '../../../runs/view/monitor';

/**
 * What a key or the mouse does to the panel: where the person is in it, and what it asks of the world — a copy, the
 * preview, the theme, to quit. Kept apart from the terminal so every key is answered the same in a test; `monitor.ts`
 * reads the keys and does what is asked.
 */

export interface Key {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
}

export type Effect =
  | { kind: 'quit' }
  | { kind: 'copy'; text: string }
  | { kind: 'start-preview' }
  | { kind: 'stop-preview' }
  | { kind: 'open-preview' }
  | { kind: 'theme' }
  /** An entry of the team set to this many (and its min no more than that): what `run team set --count` writes. */
  | { kind: 'team-count'; name: string; count: number; min?: number };

export interface Step {
  ui: MonitorUi;
  effects: Effect[];
}

/** What the panel showed when the key was pressed. */
export interface Shown {
  data?: Monitored;
  hits: readonly Hit[];
  areas: readonly Area[];
  needs: readonly Need[];
  /** The palette's items as its query finds them. */
  palette: () => PaletteItem[];
  /** Where the preview stands: `p` and `x` say so when there is nothing for them to do. */
  preview: PreviewState['kind'];
}

/** A mouse press or release, at the cell the terminal reports — counted from 1. */
export interface MouseReport {
  button: number;
  column: number;
  row: number;
  pressed: boolean;
}

/** A mouse report in SGR form: the button, the column, the row, and M pressed or m released. */
// eslint-disable-next-line no-control-regex -- a terminal's mouse report starts with ESC: it is what is matched
const MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** An answer of the terminal's (OSC … BEL or ST) — its background, asked when the panel opens. */
// eslint-disable-next-line no-control-regex -- an answer starts with ESC ] and ends with BEL or ESC \: it is what is matched
const ANSWER = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

/**
 * What the terminal sent, apart: the mouse's reports, and the keys — never a report's digits read as keys. A click's
 * `ESC[<0;12;5M`, given to the keys whole, was read as `1`, `2`, `5`: views switched, the panel turned advanced, and
 * every one redrawn — a click flickered.
 */
export const splitInput = (text: string): { mice: MouseReport[]; keys: string } => ({
  mice: [...text.matchAll(MOUSE)].map(([, button, column, row, kind]) => ({
    button: Number(button),
    column: Number(column),
    row: Number(row),
    pressed: kind === 'M'
  })),
  keys: text.replace(MOUSE, '').replace(ANSWER, '')
});

/** What the first `q` says while the panel serves the preview: a second, while it is said, quits. */
export const QUIT_WARNING = 'q again to quit — the preview stops with the monitor';

const still = (ui: MonitorUi): Step => ({ ui, effects: [] });

const copied = (ui: MonitorUi, text: string): Step => ({
  ui: { ...ui, flash: `copied: ${text}` },
  effects: [{ kind: 'copy', text }]
});

/** The keys only the advanced panel answers: what they move — a task, the activity, the spend — it alone shows. */
const ADVANCED_KEYS = new Set(['up', 'down', 'return', 'left', 'right', 'a', 's', 'y', 'w', 'e']);

const flashed = (ui: MonitorUi, said: string): Step => still({ ...ui, flash: said });

/** The next agent whose stream is followed — none past the last, as a press after it stops following. */
export const followedNext = (ui: MonitorUi, agents: readonly string[]): MonitorUi => {
  const next = agents.at(ui.agent === undefined ? 0 : agents.indexOf(ui.agent) + 1);
  const { agent: _followed, ...rest } = ui;

  return next === undefined ? { ...rest, streamBack: 0 } : { ...ui, agent: next, streamBack: 0 };
};

/** This panel serves the preview: quitting stops it, so `q` says so before it does. */
const servesPreview = (shown: Shown): boolean => shown.preview === 'starting' || shown.preview === 'serving';

/** `p`: the preview started — or, with nothing for it to do, why. */
const startPreview = (ui: MonitorUi, shown: Shown): Step => {
  if (!shown.data) {
    return flashed(ui, 'no run to preview yet');
  }

  if (shown.preview === 'stopping') {
    return flashed(ui, 'the preview is stopping — p again once it stopped');
  }

  return shown.preview === 'none' || shown.preview === 'stopped'
    ? { ui: { ...ui, flash: 'starting the preview…' }, effects: [{ kind: 'start-preview' }] }
    : flashed(ui, 'the preview is up already — x stops it');
};

/** `x`: the preview stopped, whoever serves it — or, with none served, said so. */
const stopPreview = (ui: MonitorUi, shown: Shown): Step => {
  if (shown.preview === 'stopping') {
    return flashed(ui, 'the preview is stopping');
  }

  return shown.preview === 'none' || shown.preview === 'stopped' || !shown.data
    ? flashed(ui, 'no preview is served — p starts one')
    : { ui: { ...ui, flash: 'stopping the preview…' }, effects: [{ kind: 'stop-preview' }] };
};

const switched = (ui: MonitorUi): MonitorUi => ({ ...ui, mode: ui.mode === 'simple' ? 'advanced' : 'simple' });

const quitting = (ui: MonitorUi, shown: Shown): Step =>
  servesPreview(shown) && ui.flash !== QUIT_WARNING
    ? still({ ...ui, flash: QUIT_WARNING })
    : { ui, effects: [{ kind: 'quit' }] };

const taskCount = (ui: MonitorUi, shown: Shown): number =>
  shown.data ? listedTasks(shown.data.view.tasks, ui.showApproved).length : 0;

/** What a command of the palette does: what the panel's keys do, and what only it reaches. */
const act = (ui: MonitorUi, action: PaletteAction, shown: Shown): Step => {
  const closed: MonitorUi = { ...ui, dialog: undefined };
  switch (action.kind) {
    case 'view':
      return still({ ...closed, view: action.view, selected: 0 });
    case 'task': {
      const index = shown.data ? listedTasks(shown.data.view.tasks, true).findIndex(task => task.id === action.id) : -1;

      return still({ ...closed, showApproved: true, selected: Math.max(0, index), dialog: { kind: 'task' } });
    }
    case 'copy':
      return copied(closed, action.text);
    case 'start-preview':
      return startPreview(closed, shown);
    case 'stop-preview':
      return stopPreview(closed, shown);
    case 'mode':
      return still(switched(closed));
    case 'open-preview':
      return { ui: closed, effects: [{ kind: 'open-preview' }] };
    case 'approved':
      return still({ ...closed, showApproved: !closed.showApproved, selected: 0 });
    case 'theme':
      return { ui: closed, effects: [{ kind: 'theme' }] };
    case 'team':
      return (shown.data?.team.length ?? 0) > 0
        ? still({ ...closed, dialog: { kind: 'team', at: 0 } })
        : flashed(closed, 'the team names no agent — plitzi run team set <name> --roles … adds one');
    case 'quit':
      return quitting(closed, shown);
  }
};

const inPalette = (
  ui: MonitorUi,
  dialog: { query: string; at: number },
  text: string | undefined,
  key: Key | undefined,
  shown: Shown
): Step => {
  const found = shown.palette();
  if (key?.name === 'escape') {
    return still({ ...ui, dialog: undefined });
  }

  if (key?.name === 'return') {
    const picked = found.at(dialog.at);

    return picked ? act(ui, picked.action, shown) : still(ui);
  }

  if (key?.name === 'up') {
    return still({ ...ui, dialog: { kind: 'palette', query: dialog.query, at: Math.max(0, dialog.at - 1) } });
  }

  if (key?.name === 'down') {
    const at = Math.min(Math.max(0, found.length - 1), dialog.at + 1);

    return still({ ...ui, dialog: { kind: 'palette', query: dialog.query, at } });
  }

  if (key?.name === 'backspace') {
    return still({ ...ui, dialog: { kind: 'palette', query: dialog.query.slice(0, -1), at: 0 } });
  }

  if (text?.length === 1 && text >= ' ' && key?.ctrl !== true) {
    return still({ ...ui, dialog: { kind: 'palette', query: `${dialog.query}${text}`, at: 0 } });
  }

  return still(ui);
};

/** A key pressed: what the panel becomes, and what it asks. `undefined` for what is no key — a mouse report, an answer. */
export const onKey = (
  ui: MonitorUi,
  text: string | undefined,
  key: Key | undefined,
  shown: Shown
): Step | undefined => {
  // A mouse report, or the terminal's answer about its background, is read apart — never as keys.
  if (key?.sequence?.includes('[<') === true || key?.sequence?.includes(']11;') === true) {
    return undefined;
  }

  if (key?.ctrl === true && key.name === 'c') {
    return { ui, effects: [{ kind: 'quit' }] };
  }

  const { dialog } = ui;
  if (dialog?.kind === 'palette') {
    return inPalette(ui, dialog, text, key, shown);
  }

  if (dialog !== undefined && (key?.name === 'escape' || key?.name === 'return' || text === '?')) {
    return still({ ...ui, dialog: undefined });
  }

  if (dialog?.kind === 'team') {
    return inTeam(ui, dialog, text, key, shown);
  }

  if (key?.name === 'q') {
    return quitting(ui, shown);
  }

  // Under a dialog the board is not reached: only what the dialog says it answers — a task's, another task and its id.
  const answered = dialog?.kind === 'task' && ['up', 'down', 'y'].includes(key?.name ?? '');
  if (dialog !== undefined && !answered) {
    return still(ui);
  }

  const count = taskCount(ui, shown);
  const { needs, data } = shown;
  const need = needs.at(Math.min(ui.needsAt, needs.length - 1));
  const digit = Number(text);
  if (key?.ctrl === true && key.name === 'p') {
    return still({ ...ui, dialog: { kind: 'palette', query: '', at: 0 } });
  }

  if (text === '?') {
    return still({ ...ui, dialog: { kind: 'help' } });
  }

  // A view is the advanced panel's: asked for from the simple one, the panel turns advanced to show it.
  if (Number.isInteger(digit) && digit >= 1 && digit <= VIEWS.length) {
    return still({ ...ui, mode: 'advanced', view: VIEWS[digit - 1]?.view ?? 'overview', selected: 0 });
  }

  if (ui.mode === 'simple' && ADVANCED_KEYS.has(key?.name ?? '')) {
    return still(ui);
  }

  switch (key?.name) {
    case 'down':
      return still(count > 0 ? { ...ui, selected: (ui.selected + 1) % count } : ui);
    case 'up':
      return still(count > 0 ? { ...ui, selected: (ui.selected - 1 + count) % count } : ui);
    case 'return':
      return still(count > 0 ? { ...ui, dialog: { kind: 'task' } } : ui);
    case 'left':
      return still({ ...ui, feedBack: Math.min(Math.max(0, (data?.feed.length ?? 1) - 1), ui.feedBack + 5) });
    case 'right':
      return still({ ...ui, feedBack: Math.max(0, ui.feedBack - 5) });
    case 'a':
      return still({ ...ui, showApproved: !ui.showApproved, selected: 0 });
    case 's':
      return still({
        ...ui,
        spendSort: SPEND_SORTS[(SPEND_SORTS.indexOf(ui.spendSort) + 1) % SPEND_SORTS.length] ?? 'spent'
      });
    case 't':
      return { ui, effects: [{ kind: 'theme' }] };
    case 'm':
      return still(switched(ui));
    case 'p':
      return startPreview(ui, shown);
    case 'x':
      return stopPreview(ui, shown);
    case 'o':
      return shown.preview === 'none' || shown.preview === 'stopped' || !data
        ? flashed(ui, 'no preview is served — p starts one')
        : { ui, effects: [{ kind: 'open-preview' }] };
    case 'n':
      return still(
        needs.length > 0 ? { ...ui, needsAt: (Math.min(ui.needsAt, needs.length - 1) + 1) % needs.length } : ui
      );
    case 'd':
      return still(needs.length > 0 ? { ...ui, dialog: { kind: 'needs' } } : ui);
    case 'c':
      return need?.fix === undefined ? still(ui) : copied(ui, need.fix);
    case 'escape':
      return need
        ? still({
            ...ui,
            dismissed: new Set([...ui.dismissed, need.key]),
            needsAt: 0,
            flash: 'put off — back once it says something else'
          })
        : still(ui);
    case 'w':
      return still(followedNext(ui, data?.agents.map(agent => agent.agent) ?? []));
    case 'e':
      return flashed({ ...ui, sideWide: !ui.sideWide }, ui.sideWide ? 'sidebar as it was' : 'sidebar widened');
    case 'r':
      return (data?.team.length ?? 0) > 0
        ? still({ ...ui, dialog: { kind: 'team', at: 0 } })
        : flashed(ui, 'the team names no agent — plitzi run team set <name> --roles … adds one');
    case 'y': {
      const task = data ? listedTasks(data.view.tasks, ui.showApproved).at(ui.selected) : undefined;

      return task ? copied(ui, task.id) : still(ui);
    }
    default:
      return still(ui);
  }
};

/**
 * The team, raised and lowered from the panel: ↑ ↓ an entry, + one more of it, − one fewer — its min no more than its
 * count — written as `run team set` writes it. The person watching the run set the team's size in another terminal.
 */
const inTeam = (
  ui: MonitorUi,
  dialog: Extract<Dialog, { kind: 'team' }>,
  text: string | undefined,
  key: Key | undefined,
  shown: Shown
): Step => {
  const team = shown.data?.team ?? [];
  const at = Math.min(dialog.at, Math.max(0, team.length - 1));
  if (key?.name === 'down' || key?.name === 'up') {
    const moved = team.length === 0 ? 0 : (at + (key.name === 'down' ? 1 : team.length - 1)) % team.length;

    return still({ ...ui, dialog: { kind: 'team', at: moved } });
  }

  const entry = team.at(at);
  const delta = text === '+' || text === '=' ? 1 : text === '-' || text === '_' ? -1 : 0;
  if (!entry || delta === 0) {
    return still(ui);
  }

  const count = entry.count + delta;
  if (count < 1) {
    return flashed(ui, `${entry.name} is one already — plitzi run team unset ${entry.name} takes it out of the team`);
  }

  return {
    ui: { ...ui, flash: `${entry.name}: ${String(entry.count)} → ${String(count)}` },
    effects: [{ kind: 'team-count', name: entry.name, count, ...(entry.min > count ? { min: count } : {}) }]
  };
};

/** A mouse press, at a cell counted from 0: what the panel becomes — `undefined` when it lands on nothing it answers. */
export const onMouse = (
  ui: MonitorUi,
  { button, row, col }: { button: number; row: number; col: number },
  shown: Shown
): MonitorUi | undefined => {
  if (ui.dialog) {
    return undefined;
  }

  if (button === 0) {
    const hit = shown.hits.find(each => each.row === row && col >= each.from && col < each.to);
    if (hit?.action.kind === 'view') {
      return { ...ui, view: hit.action.view, selected: 0 };
    }

    if (hit?.action.kind === 'task') {
      // A click picks a task; a click on the one picked opens it.
      return hit.action.index === ui.selected
        ? { ...ui, dialog: { kind: 'task' } }
        : { ...ui, selected: hit.action.index };
    }

    if (hit?.action.kind === 'agent') {
      // A click follows an agent's stream; a click on the one followed stops following it.
      const { agent: _followed, ...rest } = ui;

      return hit.action.agent === ui.agent
        ? { ...rest, streamBack: 0 }
        : { ...ui, agent: hit.action.agent, streamBack: 0 };
    }

    if (hit?.action.kind === 'moment') {
      const opened = new Set(ui.streamOpened);
      if (!opened.delete(hit.action.key)) {
        opened.add(hit.action.key);
      }

      return { ...ui, streamOpened: opened };
    }

    if (hit?.action.kind === 'event') {
      const opened = new Set(ui.opened);
      if (!opened.delete(hit.action.key)) {
        opened.add(hit.action.key);
      }

      return { ...ui, opened };
    }

    return undefined;
  }

  if (button !== 64 && button !== 65) {
    return undefined;
  }

  const up = button === 64;
  const over = shown.areas.find(
    each => row >= each.top && row < each.top + each.height && col >= each.left && col < each.left + each.width
  );
  const count = taskCount(ui, shown);
  if (over?.area.kind === 'activity') {
    const most = Math.max(0, (shown.data?.feed.length ?? 1) - 1);

    // The newest at the top: the wheel down goes to older events, up back to newer ones.
    return { ...ui, feedBack: Math.max(0, Math.min(most, ui.feedBack + (up ? -1 : 1))) };
  }

  // The newest at the top, as the activity: the wheel down goes to earlier moments, up back to the live end.
  if (over?.area.kind === 'stream') {
    return { ...ui, streamBack: Math.max(0, Math.min(over.area.most, ui.streamBack + (up ? -1 : 1))) };
  }

  if (over?.area.kind === 'tasks' && count > 0) {
    return { ...ui, selected: Math.max(0, Math.min(count - 1, ui.selected + (up ? -1 : 1))) };
  }

  if (over?.area.kind === 'stage') {
    const offsets = new Map(ui.flowOffsets);
    offsets.set(over.area.key, Math.max(0, (offsets.get(over.area.key) ?? 0) + (up ? -1 : 1)));

    return { ...ui, flowOffsets: offsets };
  }

  return undefined;
};
