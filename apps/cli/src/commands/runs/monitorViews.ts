import { listedTasks, timeOf, withText } from './monitorBoard';
import { clip, textWidth } from './monitorCanvas';
import { flowStages, nameOf } from './monitorFlow';
import { AGENT_LOOK, since, startsLook, TASK_LOOK, toneOf, urgencyOf } from './monitorModel';
import { agentAt, heldText, shortModel } from './monitorSide';
import { BARS, SORT_WORDS, sparkline, spendTable, tokensShort } from './monitorSpend';
import { cachedShare, costInAll, costShort } from '../../runs/spent';

import type { MonitorUi, Paint } from './monitorModel';
import type { Rect } from './monitorSide';
import type { Monitored } from '../../runs/monitor';

/** The views behind the tabs: the whole flow (2), every task (3), every agent (4), what each spent (5). */

/** How wide an empty stage of the flow is: its name and its count, no room for cards it has not got. */
const EMPTY_STAGE = 18;
/** A card's rows, and the breath under it. */
const CARD_ROWS = 5;

/** The run's kanban: a stage a column, a task a card — the wheel scrolls a stage's cards. */
export const drawFlowView = (p: Paint, data: Monitored, ui: MonitorUi, rect: Rect): void => {
  const { canvas, theme } = p;
  const stages = flowStages(data.view.tasks);
  const gap = 2;
  const full = stages.filter(stage => stage.tasks.length > 0).length;
  const free = rect.width - 4 - gap * (stages.length - 1) - EMPTY_STAGE * (stages.length - full);
  const cardWidth = full === 0 ? EMPTY_STAGE : Math.max(EMPTY_STAGE, Math.floor(free / full));
  let left = rect.left + 2;
  stages.forEach((stage, index) => {
    const lit = stage.tasks.length > 0;
    const width = index === stages.length - 1 ? rect.left + rect.width - 2 - left : lit ? cardWidth : EMPTY_STAGE;
    if (width < 6) {
      return;
    }

    const tone = lit ? toneOf(theme, stage.tone) : theme.subtle;
    for (let row = rect.top; row < rect.top + rect.height; row += 1) {
      canvas.fill(row, left, width, theme.surface);
    }

    canvas.put(rect.top + 1, left + 2, clip(`${stage.glyph} ${stage.title}`, width - 7), { fg: tone, bold: lit });
    canvas.right(rect.top + 1, left + width - 2, String(stage.tasks.length), {
      fg: lit ? theme.text : theme.subtle,
      bold: true
    });
    canvas.put(rect.top + 2, left + 2, '─'.repeat(width - 4), { fg: lit ? tone : theme.border });
    const room = Math.max(1, Math.floor((rect.height - 4) / (CARD_ROWS + 1)));
    const offset = Math.min(ui.flowOffsets.get(stage.key) ?? 0, Math.max(0, stage.tasks.length - room));
    p.areas.push({ area: { kind: 'stage', key: stage.key }, top: rect.top, left, width, height: rect.height });
    stage.tasks.slice(offset, offset + room).forEach((task, at) => {
      const top = rect.top + 4 + at * (CARD_ROWS + 1);
      const story = data.stories[task.id];
      // The card's edge in its task's own colour, as the strip and the list draw it: a task sent back read yellow above
      // and blue in its "At work" card.
      const edge = toneOf(theme, TASK_LOOK[task.status].tone);
      for (let row = top; row < top + CARD_ROWS; row += 1) {
        canvas.fill(row, left + 1, width - 2, theme.elevated);
        canvas.put(row, left + 1, '▎', { fg: edge, bg: theme.elevated });
      }

      const mark = urgencyOf(task);
      canvas.put(top + 1, left + 3, clip(nameOf(task), width - 8), { fg: theme.text, bold: true });
      if (mark) {
        canvas.right(top + 1, left + width - 3, mark, {
          fg: task.urgency === 'critical' ? theme.danger : theme.warning,
          bold: true
        });
      }

      canvas.put(top + 2, left + 3, clip(task.title, width - 6), { fg: theme.muted });
      const who = stage.key === 'approved' ? (story?.writers.join(', ') ?? '') : stage.who(task);
      const time = timeOf(task, story);
      const beside = textWidth(who) + textWidth(time) + 2 <= width - 6;
      canvas.put(top + 3, left + 3, clip(who, width - 6), {
        fg: p.hues.get(who) ?? theme.muted,
        bold: p.hues.has(who)
      });
      if (time) {
        canvas.right(beside ? top + 3 : top + 4, left + width - 3, time, { fg: theme.subtle });
      }
    });
    const below = stage.tasks.length - offset - room;
    const said = [offset > 0 ? `↑ ${String(offset)}` : '', below > 0 ? `+${String(below)} more` : '']
      .filter(Boolean)
      .join(' · ');
    if (said) {
      canvas.put(rect.top + rect.height - 1, left + 2, said, { fg: theme.subtle });
    }

    left += width + gap;
  });
};

/** A table's head: each column's name where its cells start. */
const head = (p: Paint, row: number, columns: readonly [string, number][]): void => {
  for (const [name, col] of columns) {
    p.canvas.put(row, col, name, { fg: p.theme.subtle, bold: true });
  }
};

/** Every task, a row each: where it stands, who it is with, its round and time — ↑↓ choose, ⏎ opens it. */
export const drawTasksView = (p: Paint, data: Monitored, ui: MonitorUi, rect: Rect): void => {
  const { canvas, theme, now } = p;
  const { view, stories } = data;
  const listed = listedTasks(view.tasks, ui.showApproved);
  const idWidth = Math.min(24, Math.max(4, ...listed.map(task => textWidth(task.id))));
  const c = {
    state: rect.left + 3,
    id: rect.left + 18,
    with: rect.left + 20 + idWidth,
    round: rect.left + 52 + idWidth,
    time: rect.left + 60 + idWidth,
    as: rect.left + 74 + idWidth,
    title: rect.left + 84 + idWidth
  };
  head(p, rect.top + 1, [
    ['STATE', c.state],
    ['TASK', c.id],
    ['WITH', c.with],
    ['ROUND', c.round],
    ['TIME', c.time],
    ['AS IT IS', c.as],
    ['TITLE', c.title]
  ]);
  const hidden = view.tasks.length - listed.length;
  canvas.right(
    rect.top + 1,
    rect.left + rect.width - 2,
    hidden > 0 ? `${String(hidden)} approved hidden · a lists them` : '↑↓ choose · ⏎ open',
    {
      fg: theme.subtle
    }
  );
  const rows = rect.height - 3;
  const first = Math.min(Math.max(0, ui.selected - Math.floor(rows / 2)), Math.max(0, listed.length - rows));
  p.areas.push({ area: { kind: 'tasks' }, top: rect.top + 3, left: rect.left, width: rect.width, height: rows });
  listed.slice(first, first + rows).forEach((task, offset) => {
    const row = rect.top + 3 + offset;
    const index = first + offset;
    const selected = index === ui.selected;
    const look = TASK_LOOK[task.status];
    if (selected) {
      canvas.fill(row, rect.left, rect.width, theme.selection);
      canvas.put(row, rect.left, '▎', { fg: theme.primary, bg: theme.selection });
    }

    const mark = urgencyOf(task);
    if (mark) {
      canvas.put(row, rect.left + 1, mark, {
        fg: task.urgency === 'critical' ? theme.danger : theme.warning,
        bold: true
      });
    }

    canvas.put(row, c.state, `${look.glyph} ${look.label}`, { fg: toneOf(theme, look.tone), selected });
    canvas.put(
      row,
      c.id,
      clip(task.id, idWidth),
      task.status === 'done' ? { fg: theme.subtle, strike: true } : { fg: theme.text, bold: true }
    );
    const said = withText(task, view.tasks, stories[task.id]);
    canvas.put(row, c.with, clip(said, 30), {
      fg: task.agent && said.startsWith(task.agent) ? (p.hues.get(task.agent) ?? theme.muted) : theme.muted
    });
    canvas.put(row, c.round, task.round > 0 ? String(task.round) : '—', { fg: theme.muted });
    canvas.put(row, c.time, timeOf(task, stories[task.id]), { fg: theme.muted });
    canvas.put(row, c.as, since(task.updatedAt, now), { fg: theme.subtle });
    canvas.put(row, c.title, clip(task.title, Math.max(0, rect.left + rect.width - c.title - 1)), { fg: theme.muted });
    p.hits.push({ row, from: rect.left, to: rect.left + rect.width, action: { kind: 'task', index } });
  });
};

const ROLE_SHORT: Record<string, string> = { developer: 'dev', designer: 'design', tester: 'test', writer: 'write' };

/** Every agent, a row each: whether it starts with the run, its model and roles, where it stands, what it is at. */
export const drawAgentsView = (p: Paint, data: Monitored, rect: Rect): void => {
  const { canvas, theme, now } = p;
  const tokens = new Map(data.spend.map(each => [each.agent, each.input + each.output + each.cached] as const));
  const c = {
    agent: rect.left + 4,
    kind: rect.left + 16,
    model: rect.left + 28,
    roles: rect.left + 40,
    state: rect.left + 52,
    heard: rect.left + 68,
    done: rect.left + 76,
    tokens: rect.left + 83,
    doing: rect.left + 93
  };
  head(p, rect.top + 1, [
    ['AGENT', c.agent],
    ['STARTS', c.kind],
    ['MODEL', c.model],
    ['ROLES', c.roles],
    ['STATE', c.state],
    ['HEARD', c.heard],
    ['DONE', c.done],
    ['TOKENS', c.tokens],
    ['AT', c.doing]
  ]);
  data.agents.slice(0, rect.height - 3).forEach((agent, index) => {
    const row = rect.top + 3 + index;
    const look = AGENT_LOOK[agent.status];
    canvas.put(row, rect.left + 2, look.glyph, { fg: toneOf(theme, look.tone) });
    canvas.put(row, c.agent, clip(agent.agent, 11), { fg: p.hues.get(agent.agent) ?? theme.text, bold: true });
    // Whether it starts with the run or only when work waits for it: base, on demand — the lead, the lead.
    const starts = startsLook(agent);
    canvas.put(row, c.kind, `${starts.glyph} ${starts.label}`, { fg: toneOf(theme, starts.tone) });
    canvas.put(row, c.model, clip(shortModel(agent.model), 11), { fg: theme.subtle });
    canvas.put(row, c.roles, clip(agent.roles.map(role => ROLE_SHORT[role] ?? role).join('+') || '—', 11), {
      fg: theme.muted
    });
    canvas.put(row, c.state, look.label, { fg: toneOf(theme, look.tone) });
    canvas.put(row, c.heard, since(agent.signalAt, now), { fg: theme.subtle });
    canvas.put(row, c.done, agent.approved > 0 ? `✓${String(agent.approved)}` : '—', {
      fg: agent.approved > 0 ? theme.success : theme.subtle
    });
    const spent = tokens.get(agent.agent);
    canvas.put(row, c.tokens, spent === undefined ? '—' : tokensShort(spent), { fg: theme.muted });
    // A line, never a paragraph: a question quoted whole filled the panel — the task's own dialog has all of it.
    canvas.put(
      row,
      c.doing,
      clip(
        `${agent.doing || agentAt(agent, now)}${heldText(agent, data.view.tasks)}`,
        Math.max(0, rect.left + rect.width - c.doing - 1)
      ),
      { fg: theme.muted }
    );
  });
};

/**
 * What each agent's harness spent so far, kept as each piece of its work ended: in, out and cached apart, their
 * total — every token its harness counted — and over its sessions and its tasks. `s` turns the order.
 */
export const drawSpendView = (p: Paint, data: Monitored, ui: MonitorUi, rect: Rect): void => {
  const { canvas, theme } = p;
  if (data.spend.length === 0) {
    canvas.put(
      rect.top + 1,
      rect.left + 2,
      'Nothing ended yet: an agent’s spend is kept as each piece of its work ends.',
      { fg: theme.subtle }
    );

    return;
  }

  const { rows, all } = spendTable(data.spend, data.freshAt, ui.spendSort);
  // The run's last half hour first, a column a minute, and what its whole was.
  sparkline(data.perMinute, data.perMinute.length).forEach((level, column) => {
    canvas.put(rect.top + 1, rect.left + 2 + column, level === 0 ? BARS[0] : (BARS[level - 1] ?? BARS[0]), {
      fg: level === 0 ? theme.border : theme.primary
    });
  });
  const cost = costInAll(data.spend);
  canvas.put(
    rect.top + 1,
    rect.left + 4 + data.perMinute.length,
    clip(
      [
        `last ${String(data.perMinute.length)} min`,
        `${tokensShort(all.total)} tokens`,
        `${String(cachedShare(data.spend))}% cached`,
        ...(cost === undefined ? [] : [costShort(cost)])
      ].join(' · '),
      Math.max(0, rect.width - data.perMinute.length - 6)
    ),
    { fg: theme.muted }
  );
  const top = rect.top + 3;
  const columns = [
    'WHO',
    'DONE',
    'TASKS',
    'SESS',
    'TURNS',
    'IN',
    'OUT',
    'CACHED',
    'TOTAL',
    'PER SESS',
    'PER TASK',
    'CONTEXT',
    'COST'
  ] as const;
  const cells = (each: typeof all): string[] => [
    each.agent,
    String(each.pieces),
    String(each.tasks),
    String(each.sessions),
    String(each.turns),
    tokensShort(each.input),
    tokensShort(each.output),
    tokensShort(each.cached),
    tokensShort(each.total),
    tokensShort(each.perSession),
    tokensShort(each.perTask),
    each.agent === 'all' ? '' : `${tokensShort(each.context)}${each.pastFresh ? '!' : ''}`,
    each.cost === undefined ? '—' : costShort(each.cost)
  ];
  const table = [...rows.map(cells), cells(all)];
  const widths = columns.map((name, index) => Math.max(name.length, ...table.map(row => (row[index] ?? '').length)));
  const at = (index: number): number =>
    rect.left + 2 + widths.slice(0, index).reduce((sum, width) => sum + width + 3, 0);
  canvas.right(top, rect.left + rect.width - 2, `by ${SORT_WORDS[ui.spendSort]} · s sorts`, {
    fg: theme.subtle
  });
  columns.forEach((name, index) =>
    index === 0
      ? canvas.put(top, at(index), name, { fg: theme.subtle, bold: true })
      : canvas.right(top, at(index) + (widths[index] ?? 0), name, { fg: theme.subtle, bold: true })
  );
  const line = (row: number, values: readonly string[], style: { bold?: boolean; fg?: string }, hue?: string): void =>
    values.forEach((value, index) =>
      index === 0
        ? canvas.put(row, at(index), value, { fg: hue ?? style.fg ?? theme.text, bold: true })
        : canvas.right(row, at(index) + (widths[index] ?? 0), value, {
            fg: style.fg ?? theme.muted,
            bold: style.bold ?? false
          })
    );
  rows
    .slice(0, rect.height - 12)
    .forEach((each, index) =>
      line(top + 2 + index, cells(each), { fg: each.pastFresh ? theme.warning : theme.muted }, p.hues.get(each.agent))
    );
  const foot = top + 2 + Math.min(rows.length, rect.height - 12);
  canvas.put(foot, rect.left + 2, '─'.repeat(Math.max(0, at(columns.length) - rect.left - 5)), { fg: theme.border });
  line(foot + 1, cells(all), { fg: theme.text, bold: true });
  canvas.put(
    foot + 3,
    rect.left + 2,
    'TOTAL: in + out + cached, every token its harness counted · cached: read again, a tenth of the price or less',
    { fg: theme.subtle }
  );
  canvas.put(foot + 4, rect.left + 2, 'PER SESS · PER TASK: in + out over its sessions · its tasks', {
    fg: theme.subtle
  });
  canvas.put(
    foot + 5,
    rect.left + 2,
    clip(
      'COST: at the API’s prices, each turn on its model — none on a subscription · — a model with no price',
      rect.width - 4
    ),
    { fg: theme.subtle }
  );
  if (rows.some(each => each.pastFresh)) {
    canvas.put(foot + 6, rect.left + 2, '! past its freshContextAt: started fresh after its piece', {
      fg: theme.warning
    });
  }
};
