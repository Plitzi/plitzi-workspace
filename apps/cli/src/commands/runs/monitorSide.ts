import { listedTasks, timeOf, withText, withTone } from './monitorBoard';
import { clip, textWidth } from './monitorCanvas';
import { AGENT_LOOK, since, startsLook, TASK_LOOK, toneOf, urgencyOf } from './monitorModel';
import { BARS, sparkline, spentInAll, tokensShort } from './monitorSpend';
import { cachedShare, costInAll, costShort } from '../../runs/spent';

import type { MonitorUi, Paint, PreviewShown } from './monitorModel';
import type { AgentLine, Monitored } from '../../runs/monitor';
import type { Spent } from '../../runs/spent';

/**
 * The Overview's sidebar, a surface of its own: the tasks (↑↓ choose, ⏎ opens one), the agents and where each stands,
 * what they spent, and the run's preview with what its server says. What does not fit goes first from the bottom of
 * the importance: the spend, which has a view of its own.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** What an agent is at, in the sidebar's few words. */
export const agentAt = (agent: AgentLine, now: Date): string => {
  switch (agent.status) {
    case 'working':
      return agent.task ? `on ${agent.task}` : 'working';
    case 'reviewing':
      return agent.task ? `reviewing ${agent.task}` : 'reviewing';
    case 'idle':
    case 'no-signal':
    case 'waiting':
    case 'stopped':
      return [AGENT_LOOK[agent.status].label, since(agent.signalAt, now)].filter(Boolean).join(' · ');
    default:
      return AGENT_LOOK[agent.status].label;
  }
};

/** The model's short name: what the column has room for. */
export const shortModel = (model: string | undefined): string => (model ?? 'harness').replace(/^claude-/, '');

const title = (p: Paint, row: number, rect: Rect, text: string, hint: string): void => {
  p.canvas.put(row, rect.left + 2, text, { fg: p.theme.text, bold: true });
  p.canvas.right(row, rect.left + rect.width - 2, hint, { fg: p.theme.subtle });
};

export const drawSide = (p: Paint, data: Monitored, ui: MonitorUi, preview: PreviewShown, rect: Rect): void => {
  const { canvas, theme, now } = p;
  const { view, agents, spend, stories } = data;
  for (let row = rect.top; row < rect.top + rect.height; row += 1) {
    canvas.fill(row, rect.left, rect.width, theme.surface);
  }

  const end = rect.left + rect.width - 2;
  const listed = listedTasks(view.tasks, ui.showApproved);
  const approved = view.tasks.filter(task => task.status === 'done');
  const folded = listed.length < view.tasks.length;
  const output = preview.state.kind === 'stopped' ? preview.state.said : preview.output;
  const runRows = 4 + Math.min(3, output.length);
  const agentRows = 3 + agents.length;
  // Two lines an agent: its bar, and what the bar is — in, out and its context read again (Carlos asked where 1.7M came from).
  // Above them the run's: its last half hour a chart, and its tokens with how much of them was read again.
  const spendRows = 4 + (spend.length === 0 ? 0 : 3) + 2 * Math.min(4, Math.max(1, spend.length));
  // What the tasks may take once the rest has its rows: the spend given up first, the tasks never fewer than three.
  const fixed = runRows + agentRows;
  const withSpend = rect.height - fixed - spendRows >= 3 + 3 + (folded ? 1 : 0);
  const taskRoom = Math.max(3, rect.height - fixed - (withSpend ? spendRows : 0) - 3 - (folded ? 1 : 0));

  // Tasks.
  let row = rect.top + 1;
  title(p, row, rect, `Tasks ${String(view.tasks.length)}`, '↑↓ · ⏎ open');
  row += 2;
  const shown = Math.min(listed.length, taskRoom);
  const first = Math.min(Math.max(0, ui.selected - Math.floor(shown / 2)), Math.max(0, listed.length - shown));
  p.areas.push({ area: { kind: 'tasks' }, top: row, left: rect.left, width: rect.width, height: shown });
  const idWidth = Math.min(18, Math.max(6, ...listed.map(task => textWidth(task.id))));
  listed.slice(first, first + shown).forEach((task, offset) => {
    const index = first + offset;
    const selected = index === ui.selected && ui.view === 'overview';
    const look = TASK_LOOK[task.status];
    if (selected) {
      canvas.fill(row, rect.left, rect.width, theme.selection);
      canvas.put(row, rect.left, '▎', { fg: theme.primary, bg: theme.selection });
    }

    const done = task.status === 'done';
    canvas.put(row, rect.left + 2, look.glyph, { fg: toneOf(theme, look.tone), bold: true, selected });
    canvas.put(
      row,
      rect.left + 4,
      clip(task.id, idWidth),
      done ? { fg: theme.subtle, strike: true } : { fg: theme.text, bold: selected, selected }
    );
    const mark = urgencyOf(task);
    if (mark) {
      canvas.put(row, rect.left + 5 + idWidth, mark, {
        fg: task.urgency === 'critical' ? theme.danger : theme.warning,
        bold: true
      });
    }

    const time = timeOf(task, stories[task.id]);
    const timeAt = end - textWidth(time);
    const said = withText(task, view.tasks, stories[task.id]);
    const hue = task.agent === undefined ? undefined : p.hues.get(task.agent);
    canvas.put(row, rect.left + 7 + idWidth, clip(said, Math.max(0, timeAt - rect.left - 9 - idWidth)), {
      fg: hue !== undefined && said.startsWith(task.agent ?? '\u0000') ? hue : toneOf(theme, withTone(task))
    });
    canvas.put(row, timeAt, time, { fg: theme.subtle });
    p.hits.push({ row, from: rect.left, to: rect.left + rect.width, action: { kind: 'task', index } });
    row += 1;
  });
  if (listed.length > shown) {
    canvas.right(rect.top + 1, end - 14, `${String(first + 1)}–${String(first + shown)} of ${String(listed.length)}`, {
      fg: theme.subtle
    });
  }

  if (folded) {
    canvas.put(row, rect.left + 2, clip(`✓ ${String(approved.length)} approved · a lists them`, rect.width - 4), {
      fg: theme.success
    });
    row += 1;
  }

  // Agents.
  row += 1;
  const running = agents.filter(agent => !['not-started', 'stopped', 'done'].includes(agent.status)).length;
  title(p, row, rect, 'Agents', `${String(running)} of ${String(agents.length)} running`);
  row += 2;
  for (const agent of agents) {
    const look = AGENT_LOOK[agent.status];
    canvas.put(row, rect.left + 2, look.glyph, { fg: toneOf(theme, look.tone) });
    canvas.put(row, rect.left + 4, clip(agent.agent, 10), { fg: p.hues.get(agent.agent) ?? theme.text, bold: true });
    // Base or on demand, marked beside the name: who keeps running and who only comes for work.
    const starts = startsLook(agent);
    canvas.put(row, rect.left + 15, starts.glyph, { fg: toneOf(theme, starts.tone) });
    canvas.put(row, rect.left + 17, clip(shortModel(agent.model), 10), { fg: theme.subtle });
    const at = agentAt(agent, now);
    canvas.right(row, end, clip(at, Math.max(0, rect.width - 32)), { fg: toneOf(theme, look.tone) });
    row += 1;
  }

  // Spend.
  if (withSpend) {
    row += 1;
    const total = spentInAll(spend);
    const cost = costInAll(spend);
    title(p, row, rect, 'Spend', cost === undefined ? '' : costShort(cost));
    row += 2;
    if (spend.length === 0) {
      canvas.put(row, rect.left + 2, 'nothing ended yet', { fg: theme.subtle });
      row += 1;
    } else {
      const span = `last ${String(data.perMinute.length)} min`;
      sparkline(data.perMinute, end - rect.left - 4 - textWidth(span)).forEach((level, column) => {
        canvas.put(row, rect.left + 2 + column, level === 0 ? BARS[0] : (BARS[level - 1] ?? BARS[0]), {
          fg: level === 0 ? theme.border : theme.primary
        });
      });
      canvas.right(row, end, span, { fg: theme.subtle });
      row += 1;
      canvas.put(row, rect.left + 2, `${tokensShort(total)} tokens`, { fg: theme.muted });
      canvas.right(row, end, `${String(cachedShare(spend))}% cached`, { fg: theme.subtle });
      row += 2;
      // A bar, its order and its figure say the same: what it cost when the whole run has a price, its tokens if not.
      const figure = (each: Spent): number =>
        cost === undefined ? each.input + each.output + each.cached : (each.cost ?? 0);
      const heaviest = [...spend].sort((a, b) => figure(b) - figure(a) || a.agent.localeCompare(b.agent)).slice(0, 4);
      const most = Math.max(Number.MIN_VALUE, ...heaviest.map(figure));
      const barWidth = Math.max(4, rect.width - 26);
      for (const each of heaviest) {
        const tokens = each.input + each.output + each.cached;
        const filled = Math.max(1, Math.round((figure(each) / most) * barWidth));
        const hue = p.hues.get(each.agent) ?? theme.primary;
        canvas.put(row, rect.left + 2, clip(each.agent, 10), { fg: hue, bold: true });
        canvas.put(row, rect.left + 13, '█'.repeat(filled), { fg: hue });
        canvas.put(row, rect.left + 13 + filled, '░'.repeat(barWidth - filled), { fg: theme.border });
        canvas.right(row, end, cost === undefined ? tokensShort(tokens) : costShort(figure(each)), {
          fg: theme.muted
        });
        row += 1;
        canvas.put(
          row,
          rect.left + 13,
          clip(
            `in ${tokensShort(each.input)} · out ${tokensShort(each.output)} · cache ${tokensShort(each.cached)}`,
            Math.max(0, end - rect.left - 13)
          ),
          { fg: theme.subtle }
        );
        row += 1;
      }
    }
  }

  // Run: its preview — served from here (p) — and what its server says.
  row = Math.max(row + 1, rect.top + rect.height - runRows);
  title(p, row, rect, 'Run', `${String(view.approvedFiles)} files approved`);
  row += 2;
  drawPreviewLine(p, row, rect.left + 2, end, preview);
  row += 1;
  for (const line of output.slice(-3)) {
    canvas.put(row, rect.left + 2, '⎿ ', { fg: theme.subtle });
    canvas.put(row, rect.left + 4, clip(line, rect.width - 6), { fg: theme.muted });
    row += 1;
  }
};

/** The preview's line: its address a link a click opens, where it stands, and the key that serves or stops it. */
export const drawPreviewLine = (p: Paint, row: number, col: number, end: number, preview: PreviewShown): void => {
  const { canvas, theme } = p;
  const { state } = preview;
  const at = canvas.put(row, col, 'Preview', { fg: theme.muted });
  if (
    state.kind === 'serving' ||
    state.kind === 'elsewhere' ||
    state.kind === 'starting' ||
    state.kind === 'stopping'
  ) {
    const passing = state.kind === 'starting' || state.kind === 'stopping';
    const after = canvas.put(row, at + 2, passing ? '◌' : '●', { fg: passing ? theme.warning : theme.success });
    const urlEnd = canvas.put(row, after + 1, state.url, { fg: theme.link, underline: true, link: state.url });
    const keys = passing ? `${state.kind}…` : 'o open · x stop';
    // Said where the row has room after the address, never over it.
    if (end - urlEnd >= textWidth(keys) + 2) {
      canvas.right(row, end, keys, { fg: theme.subtle });
    }
    return;
  }

  canvas.put(row, at + 2, clip(state.kind === 'stopped' ? state.why : 'not served', Math.max(0, end - at - 16)), {
    fg: state.kind === 'stopped' ? theme.danger : theme.subtle
  });
  canvas.right(row, end, 'p start', { fg: theme.subtle });
};
