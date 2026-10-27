import { storyLines, timeOf } from './monitorBoard';
import { clip, wrap } from './monitorCanvas';
import { EVENT_TONE, whatOf } from './monitorFeed';
import { hhmm, TASK_LOOK, toneOf, urgencyOf, VIEWS } from './monitorModel';
import { keyHint } from './monitorNeeds';

import type { Need } from './monitorAttention';
import type { MonitorMode, MonitorView, Paint } from './monitorModel';
import type { Monitored } from '../../../runs/view/monitor';
import type { TaskLine } from '../../../runs/view/view';

/**
 * What opens over the board — a task whole, every notice, the keys, the command palette — each a surface raised over
 * the board, the board receding under it, as OpenCode's dialogs are.
 */

interface Frame {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** A dialog's frame, centred: the board receding, a shadow under it, its title and how it closes. */
const raise = (p: Paint, width: number, height: number, title: string, closes = 'esc close'): Frame => {
  const { canvas, theme } = p;
  const frame = {
    width: Math.min(width, canvas.width - 4),
    height: Math.min(height, canvas.height - 2),
    top: 0,
    left: 0
  };
  frame.top = Math.max(1, Math.floor((canvas.height - frame.height) / 3));
  frame.left = Math.floor((canvas.width - frame.width) / 2);
  canvas.recede(frame);
  for (let row = frame.top; row < frame.top + frame.height; row += 1) {
    canvas.fill(row, frame.left, frame.width, theme.elevated);
  }

  canvas.shadow(frame);
  canvas.put(frame.top + 1, frame.left + 3, title, { fg: theme.text, bold: true });
  canvas.right(frame.top + 1, frame.left + frame.width - 3, closes, { fg: theme.subtle });

  return frame;
};

/** A task whole: where it stands, its story, its files, what happened to it — ↑↓ another, y copies its id. */
export const drawTaskDialog = (p: Paint, data: Monitored, task: TaskLine): void => {
  const { canvas, theme } = p;
  const story = data.stories[task.id];
  const lines = storyLines(task, story);
  const events = data.feed
    .filter(line => line.task === task.id)
    .slice(0, 5)
    .reverse();
  const height =
    9 +
    lines.length +
    (task.files.length > 0 ? 2 + Math.min(4, task.files.length) : 0) +
    (events.length > 0 ? 2 + events.length : 0);
  const frame = raise(p, 92, height, '', 'esc close');
  const end = frame.left + frame.width - 3;
  const look = TASK_LOOK[task.status];
  let col = canvas.put(frame.top + 1, frame.left + 3, `${look.glyph} ${task.id}`, { fg: theme.text, bold: true });
  canvas.put(frame.top + 1, col + 2, clip(task.title, Math.max(0, end - col - 14)), { fg: theme.muted });
  let row = frame.top + 3;
  col = canvas.put(row, frame.left + 3, ` ${look.glyph} ${look.label} `, {
    fg: toneOf(theme, look.tone),
    bg: theme.selection,
    bold: true
  });
  const mark = urgencyOf(task);
  if (mark) {
    col = canvas.put(row, col + 1, ` ${mark} ${task.urgency} `, { fg: theme.warning, bg: theme.warningBg, bold: true });
  }

  if (task.agent) {
    col = canvas.put(row, col + 2, task.agent, { fg: p.hues.get(task.agent) ?? theme.text, bold: true });
  }

  const facts = [
    task.role,
    task.round > 0 ? `round ${String(task.round)}` : '',
    timeOf(task, story) || `${String(task.estimateMinutes)}m estimated`,
    task.milestone ?? ''
  ].filter(Boolean);
  canvas.put(row, col + 2, clip(`· ${facts.join(' · ')}`, Math.max(0, end - col - 2)), { fg: theme.muted });
  row += 2;
  for (const line of lines) {
    canvas.put(row, frame.left + 3, clip(line.text, frame.width - 6), { fg: toneOf(theme, line.tone) });
    row += 1;
  }

  if (task.files.length > 0) {
    row += 1;
    canvas.put(row, frame.left + 3, 'Files', { fg: theme.text, bold: true });
    row += 1;
    for (const file of task.files.slice(0, 4)) {
      canvas.put(row, frame.left + 5, clip(file, frame.width - 8), { fg: theme.link });
      row += 1;
    }
  }

  if (events.length > 0) {
    row += 1;
    canvas.put(row, frame.left + 3, 'Its story', { fg: theme.text, bold: true });
    row += 1;
    for (const line of events) {
      canvas.put(row, frame.left + 3, hhmm(line.at), { fg: theme.subtle });
      canvas.put(row, frame.left + 10, '●', { fg: toneOf(theme, EVENT_TONE[line.kind]) });
      const after = canvas.put(row, frame.left + 12, line.by, { fg: p.hues.get(line.by) ?? theme.text, bold: true });
      canvas.put(row, after + 2, clip(whatOf(line), Math.max(0, end - after - 2)), { fg: theme.text });
      row += 1;
    }
  }

  col = keyHint(p, frame.top + frame.height - 2, frame.left + 3, '↑↓', 'another task', theme.surface);
  keyHint(p, frame.top + frame.height - 2, col, 'y', 'copy its id', theme.surface);
};

/** Every notice whole, each its sort, its task and agent, and all it says: what the box shows one of. */
export const drawNeedsDialog = (p: Paint, needs: readonly Need[]): void => {
  const { canvas, theme } = p;
  const width = Math.min(110, canvas.width - 6);
  const bodies = needs.map(need => wrap(need.said, width - 10));
  const height = 5 + bodies.reduce((sum, body) => sum + body.length + 2, 0);
  const frame = raise(p, width, height, `Needs · ${String(needs.length)}`);
  let row = frame.top + 3;
  needs.forEach((need, index) => {
    if (row >= frame.top + frame.height - 1) {
      return;
    }

    let col = canvas.put(row, frame.left + 3, '▲ ', { fg: need.person ? theme.danger : theme.warning, bold: true });
    col = canvas.put(row, col, need.sort, { fg: theme.text, bold: true });
    if (need.task) {
      col = canvas.put(row, col + 2, need.task, { fg: theme.link });
    }

    if (need.agent) {
      canvas.put(row, col + 1, need.agent, { fg: p.hues.get(need.agent) ?? theme.muted, bold: true });
    }

    canvas.right(row, frame.left + frame.width - 3, need.person ? 'yours' : 'the lead’s', { fg: theme.subtle });
    row += 1;
    for (const line of bodies[index] ?? []) {
      canvas.put(row, frame.left + 5, line, { fg: theme.muted });
      row += 1;
    }

    row += 1;
  });
};

/** The keys of the mode it is in: what the status bar has no room for. A simple panel's are only its own. */
export const drawHelp = (p: Paint, mode: MonitorMode): void => {
  const { canvas, theme } = p;
  // Each key, and whether the simple panel answers it.
  const all: [string, string, boolean][] = [
    [
      'm',
      mode === 'simple' ? 'advanced: the views, the whole activity, the spend' : 'simple: only what you act on',
      true
    ],
    ['1–5', 'the views: overview, flow, tasks, agents, spend', false],
    ['↑ ↓', 'a task — ⏎ opens it whole', false],
    ['← →', 'older, newer activity', false],
    ['click ▸', 'opens a line: its whole, its repeats', false],
    ['a', 'shows or hides the approved tasks', false],
    ['p', 'starts the run’s preview', true],
    ['x', 'stops the preview — whoever serves it', true],
    ['o', 'opens the preview in the browser', true],
    ['n', 'the next notice', true],
    ['d', 'every notice, whole', true],
    ['c', 'copies the fix the notice names', true],
    ['esc', 'puts the notice off — back once it says something else', true],
    ['y', 'copies the task’s id', false],
    ['s', 'sorts the spend (view 5)', false],
    ['t', 'light or dark', true],
    ['ctrl+p', 'commands: every task, agent, view and fix', true],
    ['q', 'quits — twice while a preview runs from here: it stops too', true]
  ];
  const keys = all.filter(([, , simple]) => mode === 'advanced' || simple);
  const frame = raise(p, 74, keys.length + 5, 'Keys');
  keys.forEach(([key, what], index) => {
    canvas.put(frame.top + 3 + index, frame.left + 3, key, { fg: theme.text, bold: true });
    canvas.put(frame.top + 3 + index, frame.left + 16, clip(what, frame.width - 19), { fg: theme.muted });
  });
};

/** What a command of the palette does: what the panel's keys do, and what only it reaches. */
export type PaletteAction =
  | { kind: 'view'; view: MonitorView }
  | { kind: 'task'; id: string }
  | { kind: 'copy'; text: string }
  | { kind: 'start-preview' }
  | { kind: 'stop-preview' }
  | { kind: 'open-preview' }
  | { kind: 'mode' }
  | { kind: 'approved' }
  | { kind: 'theme' }
  | { kind: 'quit' };

export interface PaletteItem {
  group: string;
  label: string;
  hint: string;
  action: PaletteAction;
  /** Its hue: an agent's, a task's state. */
  tone?: string;
}

/** Everything the palette finds: the views, every task, each agent, each fix a notice names, the panel's switches. */
export const paletteItems = (p: Paint, data: Monitored, needs: readonly Need[]): PaletteItem[] => {
  const { theme } = p;

  return [
    ...needs.flatMap(need =>
      need.fix === undefined
        ? []
        : [{ group: 'Copy', label: need.fix, hint: need.sort, action: { kind: 'copy' as const, text: need.fix } }]
    ),
    ...data.view.tasks.map(task => ({
      group: 'Tasks',
      label: `${TASK_LOOK[task.status].glyph} ${task.id}`,
      hint: task.title,
      action: { kind: 'task' as const, id: task.id },
      tone: toneOf(theme, TASK_LOOK[task.status].tone)
    })),
    ...data.agents.map(agent => ({
      group: 'Agents',
      label: agent.agent,
      hint: agent.doing,
      action: { kind: 'copy' as const, text: `plitzi task message @${agent.agent} "…"` },
      ...(p.hues.has(agent.agent) ? { tone: p.hues.get(agent.agent) } : {})
    })),
    ...VIEWS.map(({ view, label }, index) => ({
      group: 'View',
      label,
      hint: String(index + 1),
      action: { kind: 'view' as const, view }
    })),
    { group: 'Panel', label: 'Start the preview', hint: 'p', action: { kind: 'start-preview' } },
    { group: 'Panel', label: 'Stop the preview', hint: 'x', action: { kind: 'stop-preview' } },
    { group: 'Panel', label: 'Open the preview', hint: 'o', action: { kind: 'open-preview' } },
    { group: 'Panel', label: 'Simple or advanced', hint: 'm', action: { kind: 'mode' } },
    { group: 'Panel', label: 'Show or hide the approved tasks', hint: 'a', action: { kind: 'approved' } },
    {
      group: 'Panel',
      label: `Theme · plitzi ${theme.name === 'dark' ? 'light' : 'dark'}`,
      hint: 't',
      action: { kind: 'theme' }
    },
    { group: 'Panel', label: 'Quit', hint: 'q', action: { kind: 'quit' } }
  ];
};

/** How well `query` finds `text`: its letters in order, earlier and closer together the better — none when they are not. */
export const matchScore = (query: string, text: string): number | undefined => {
  const wanted = query.toLowerCase().replace(/\s+/g, '');
  const haystack = text.toLowerCase();
  if (wanted === '') {
    return 0;
  }

  const whole = haystack.indexOf(wanted);
  if (whole !== -1) {
    return 1000 - whole;
  }

  let at = -1;
  let gaps = 0;
  for (const char of wanted) {
    const next = haystack.indexOf(char, at + 1);
    if (next === -1) {
      return undefined;
    }

    gaps += at === -1 ? next : next - at - 1;
    at = next;
  }

  return 500 - gaps;
};

/** The palette's items that `query` finds, the best first, grouped as found. */
export const paletteFound = (items: readonly PaletteItem[], query: string): PaletteItem[] =>
  items
    .flatMap(item => {
      const score = matchScore(query, `${item.label} ${item.hint}`);

      return score === undefined ? [] : [{ item, score }];
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

export const drawPalette = (p: Paint, found: readonly PaletteItem[], query: string, at: number): void => {
  const { canvas, theme } = p;
  const rows = Math.min(14, Math.max(1, found.length));
  const frame = raise(p, 80, rows + 7, 'Commands', 'esc');
  canvas.fill(frame.top + 3, frame.left + 2, frame.width - 4, theme.surface);
  const col = canvas.put(frame.top + 3, frame.left + 4, '› ', { fg: theme.primary, bold: true });
  const after = canvas.put(frame.top + 3, col, query, { fg: theme.text });
  canvas.put(frame.top + 3, after, '▏', { fg: theme.primary, bold: true });
  if (query === '') {
    canvas.put(frame.top + 3, after + 2, 'a task, an agent, a view, a fix…', { fg: theme.subtle });
  }

  if (found.length === 0) {
    canvas.put(frame.top + 5, frame.left + 4, `Nothing is called "${query}"`, { fg: theme.subtle });

    return;
  }

  const first = Math.min(Math.max(0, at - Math.floor(rows / 2)), Math.max(0, found.length - rows));
  found.slice(first, first + rows).forEach((item, offset) => {
    const row = frame.top + 5 + offset;
    const selected = first + offset === at;
    if (selected) {
      canvas.fill(row, frame.left + 2, frame.width - 4, theme.selection);
      canvas.put(row, frame.left + 2, '▎', { fg: theme.primary, bg: theme.selection });
    }

    canvas.put(row, frame.left + 4, item.group, { fg: theme.subtle });
    const label = canvas.put(row, frame.left + 13, clip(item.label, 40), {
      fg: item.tone ?? theme.text,
      bold: selected,
      selected
    });
    canvas.right(
      row,
      frame.left + frame.width - 4,
      clip(item.hint, Math.max(0, frame.left + frame.width - 6 - label)),
      { fg: theme.muted }
    );
  });
};
