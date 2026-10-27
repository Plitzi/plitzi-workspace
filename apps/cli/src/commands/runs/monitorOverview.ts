import { clip, textWidth, wrap } from './monitorCanvas';
import { EVENT_TONE, groupKey, openedRows, opens, whatOf } from './monitorFeed';
import { flowStages } from './monitorFlow';
import { AGENT_LOOK, hhmm, LIVE_VERB, liveVerb, since, toneOf, urgencyOf } from './monitorModel';
import { drawPreviewLine, shortModel } from './monitorSide';

import type { MonitorUi, Paint, PreviewShown, Tone } from './monitorModel';
import type { Rect } from './monitorSide';
import type { FeedLine, Monitored } from '../../runs/monitor';

/**
 * The Overview's main column, told as Claude Code tells its work: the run's activity as a transcript — a dot and who did
 * what, the newest first, what opens under a line under `⎿` — the flow in brief at its foot, and what is live now on the
 * prompt: each agent at work with a spinner, its verb shimmering, how long it has been at it.
 */

/** The spinner's frames: Claude Code's own. */
export const SPINNER = ['✻', '✶', '✳', '✢', '·', '✢', '✳', '✶'];

/** The rows the flow in brief takes: a breath, its title, the stages, their rule, two rows of cards. */
const BRIEF_ROWS = 6;

/** The live agents shown at most: the rest are the Agents view's. */
const LIVE_MOST = 4;

/** Who said it, and to whom for a message: the agents in their hues. */
export const drawWho = (p: Paint, row: number, col: number, line: FeedLine): number => {
  const hue = (name: string) => p.hues.get(name) ?? p.theme.text;
  let at = p.canvas.put(row, col, line.by, { fg: hue(line.by), bold: true });
  if (line.to !== undefined) {
    at = p.canvas.put(row, at, ' → ', { fg: p.theme.subtle });
    at = p.canvas.put(row, at, line.to, { fg: p.hues.get(line.to) ?? p.theme.subtle, bold: p.hues.has(line.to) });
  }

  return at;
};

/** An event's row: its time, its dot, who, the task it is about, what — and how many times, when repeated. */
const drawEvent = (p: Paint, row: number, line: FeedLine, rect: Rect, opened: boolean): void => {
  const { canvas, theme } = p;
  const end = rect.left + rect.width;
  if (opens(line)) {
    canvas.put(row, rect.left, opened ? '▾' : '▸', { fg: theme.subtle });
  }

  canvas.put(row, rect.left + 2, hhmm(line.at), { fg: theme.subtle });
  canvas.put(row, rect.left + 8, '●', { fg: toneOf(theme, EVENT_TONE[line.kind]) });
  let col = drawWho(p, row, rect.left + 10, line);
  if (line.task !== undefined) {
    col = canvas.put(row, col + 2, line.task, { fg: theme.link });
  }

  const again = line.count === undefined ? '' : ` ×${String(line.count)} since ${hhmm(line.since ?? line.at)}`;
  const tone =
    line.kind === 'message'
      ? 'text'
      : line.kind === 'run'
        ? 'text'
        : line.kind === 'take' || line.kind === 'agent'
          ? 'muted'
          : EVENT_TONE[line.kind];
  const room = Math.max(0, end - col - 2 - textWidth(again));
  col = canvas.put(row, col + 2, clip(whatOf(line), room), { fg: toneOf(theme, tone) });
  if (again) {
    canvas.put(row, col, again, { fg: theme.subtle });
  }

  p.hits.push({ row, from: rect.left, to: end, action: { kind: 'event', key: groupKey(line) } });
};

/**
 * The activity, the newest first — as the simple panel's Latest, one order everywhere (Carlos read the two as opposite)
 * — scrolled `feedBack` events back: each event and what is opened under it, as many as the rows hold.
 */
const drawActivity = (p: Paint, feed: readonly FeedLine[], ui: MonitorUi, rect: Rect): void => {
  const { canvas, theme } = p;
  const end = rect.left + rect.width;
  canvas.put(rect.top, rect.left + 2, 'Activity', { fg: theme.text, bold: true });
  const rows = rect.height - 2;
  // What is opened under an event, each part wrapped to the panel's width: a long message read whole, never cut by "…"
  // (Carlos). Its time, when it has one, on its first line, the lines after it under its text.
  const textLeft = rect.left + 13;
  type Line = { first: boolean; at?: string; text: string; lead: number };
  const wrapped = (each: { at?: string; text: string }): Line[] => {
    const lead = each.at === undefined ? 0 : textWidth(`${hhmm(each.at)}  `);

    return wrap(each.text, Math.max(10, end - textLeft - lead)).map((text, index) => ({
      first: index === 0,
      ...(index === 0 && each.at !== undefined ? { at: each.at } : {}),
      text,
      lead
    }));
  };
  type Shown = { line: FeedLine; under: Line[] };
  const shown: Shown[] = [];
  let used = 0;
  // The feed is the newest first: the newest shown is `feedBack` into it, and each older one goes below.
  let index = Math.min(ui.feedBack, Math.max(0, feed.length - 1));
  for (; index < feed.length; index += 1) {
    const line = feed[index];
    const under = ui.opened.has(groupKey(line)) ? openedRows(line).flatMap(wrapped) : [];
    if (used + 1 + under.length > rows) {
      break;
    }

    shown.push({ line, under });
    used += 1 + under.length;
  }

  const older = feed.length - index;
  const newer = Math.min(ui.feedBack, feed.length);
  const hint = [
    `${String(feed.length)} events`,
    ...(older > 0 ? [`← ${String(older)} older`] : []),
    ...(newer > 0 ? [`→ ${String(newer)} newer`] : []),
    ...(shown.some(({ line }) => opens(line)) ? ['click ▸ opens'] : [])
  ].join(' · ');
  canvas.right(rect.top, end, hint, { fg: theme.subtle });
  if (feed.length === 0) {
    canvas.put(rect.top + 2, rect.left + 2, 'Nothing has happened yet: the run’s first take shows here.', {
      fg: theme.subtle
    });

    return;
  }

  p.areas.push({ area: { kind: 'activity' }, top: rect.top + 2, left: rect.left, width: rect.width, height: rows });
  let row = rect.top + 2;
  for (const { line, under } of shown) {
    drawEvent(p, row, line, rect, under.length > 0);
    row += 1;
    for (const each of under) {
      // The mark on a part's first line alone: a part wrapped reads as one.
      if (each.first) {
        canvas.put(row, rect.left + 10, '⎿ ', { fg: theme.subtle });
      }

      const col =
        each.at === undefined
          ? textLeft + (each.first ? 0 : each.lead)
          : canvas.put(row, textLeft, `${hhmm(each.at)}  `, { fg: theme.subtle });
      canvas.put(row, col, clip(each.text, Math.max(0, end - col)), { fg: theme.muted });
      row += 1;
    }
  }
};

/** The flow in brief: each stage, how many, which — the whole board is view 2. */
const drawBrief = (p: Paint, data: Monitored, top: number, rect: Rect): void => {
  const { canvas, theme } = p;
  const end = rect.left + rect.width;
  canvas.put(top, rect.left + 2, 'Flow', { fg: theme.text, bold: true });
  canvas.right(top, end, '2 the whole board', { fg: theme.subtle });
  const stages = flowStages(data.view.tasks);
  const gap = 2;
  const colWidth = Math.floor((rect.width - 2 - gap * (stages.length - 1)) / stages.length);
  stages.forEach((stage, index) => {
    const left = rect.left + 2 + index * (colWidth + gap);
    const lit = stage.tasks.length > 0;
    const tone = lit ? toneOf(theme, stage.tone) : theme.subtle;
    canvas.put(top + 1, left, clip(`${stage.glyph} ${stage.title}`, colWidth - 3), { fg: tone, bold: lit });
    canvas.right(top + 1, left + colWidth, String(stage.tasks.length), {
      fg: lit ? theme.text : theme.subtle,
      bold: true
    });
    canvas.put(top + 2, left, '▔'.repeat(colWidth), { fg: lit ? tone : theme.border });
    if (!lit) {
      canvas.put(top + 3, left, '—', { fg: theme.subtle });
    }

    stage.tasks.slice(0, 2).forEach((task, at) => {
      const mark = urgencyOf(task);
      const more = at === 1 && stage.tasks.length > 2 ? ` +${String(stage.tasks.length - 2)}` : '';
      let col = left;
      if (mark) {
        col = canvas.put(top + 3 + at, col, `${mark} `, { fg: theme.warning, bold: true });
      }

      col = canvas.put(top + 3 + at, col, clip(task.id, Math.max(1, left + colWidth - col - textWidth(more))), {
        fg: theme.text
      });
      if (more) {
        canvas.put(top + 3 + at, col, more, { fg: theme.subtle });
      }
    });
  });
};

/**
 * The verb in the tone of what the agent is at — writing in the accent, asking in amber, restarting in blue — a light
 * sweeping across it: an agent at work, seen to be. Every verb shimmered in the accent, so none told its state.
 */
export const shimmer = (p: Paint, row: number, col: number, word: string, frame: number, tone: Tone): number => {
  const sweep = frame % (word.length + 6);
  let at = col;
  let index = 0;
  for (const char of word) {
    const near = Math.abs(index - sweep + 2) <= 1;
    at = p.canvas.put(row, at, char, { fg: near ? p.theme.text : toneOf(p.theme, tone), bold: true });
    index += 1;
  }

  return at;
};

/** The agents live now, on the prompt: each at work with its spinner, its verb, its task and how long. */
const drawLive = (p: Paint, data: Monitored, ui: MonitorUi, top: number, rect: Rect): void => {
  const { canvas, theme, now } = p;
  const end = rect.left + rect.width;
  const live = data.agents.filter(agent => LIVE_VERB[agent.status] !== undefined).slice(0, LIVE_MOST);
  const nameWidth = Math.min(12, Math.max(4, ...live.map(agent => textWidth(agent.agent))));
  canvas.put(top, rect.left + 2, '─'.repeat(Math.max(0, rect.width - 2)), { fg: theme.border });
  if (live.length === 0) {
    canvas.put(top + 1, rect.left + 2, 'No agent is at work now.', { fg: theme.subtle });

    return;
  }

  live.forEach((agent, index) => {
    const row = top + 1 + index;
    const task = data.view.tasks.find(each => each.id === agent.task);
    const tone = AGENT_LOOK[agent.status].tone;
    canvas.put(row, rect.left + 2, SPINNER[(ui.frame + index * 3) % SPINNER.length] ?? '✻', {
      fg: toneOf(theme, tone),
      bold: true
    });
    canvas.put(row, rect.left + 4, clip(agent.agent, nameWidth), {
      fg: p.hues.get(agent.agent) ?? theme.text,
      bold: true
    });
    // An agent at no task — the lead between reviews — works at what it says it does.
    const verb = liveVerb(agent);
    let col = shimmer(p, row, rect.left + 6 + nameWidth, `${verb}…`, ui.frame + index * 4, tone);
    if (agent.task) {
      col = canvas.put(row, col + 1, agent.task, { fg: theme.link });
    }

    const elapsed = since(task?.takenAt ?? agent.signalAt, now);
    const metrics = [elapsed, shortModel(agent.model)].filter(Boolean).join(' · ');
    const metricsAt = end - textWidth(metrics);
    const step =
      agent.status === 'asking'
        ? (task?.asking?.text ?? agent.doing)
        : agent.task === undefined
          ? agent.doing
          : (task?.step ?? '');
    if (step) {
      canvas.put(row, col, clip(`${agent.task === undefined ? ' ' : ' — '}${step}`, Math.max(0, metricsAt - col - 2)), {
        fg: theme.muted
      });
    }

    canvas.put(row, metricsAt, metrics, { fg: theme.subtle });
  });
};

/** How many rows the live area takes: its rule and an agent a row, one row when none is at work. */
export const liveRows = (data: Monitored): number =>
  1 + Math.max(1, Math.min(LIVE_MOST, data.agents.filter(agent => LIVE_VERB[agent.status] !== undefined).length));

export const drawOverviewMain = (
  p: Paint,
  data: Monitored,
  ui: MonitorUi,
  preview: PreviewShown,
  rect: Rect,
  withPreview: boolean
): void => {
  const liveTop = rect.top + rect.height - liveRows(data);
  // On a narrow terminal the sidebar is gone: the preview, what its server says, sits over the live agents.
  const output = preview.state.kind === 'stopped' ? preview.state.said : preview.output;
  const previewRows = withPreview ? 2 + Math.min(2, output.length) : 0;
  const previewTop = liveTop - previewRows;
  const brief = rect.height - liveRows(data) - previewRows >= 16;
  const briefTop = previewTop - (brief ? BRIEF_ROWS : 0);
  drawActivity(p, data.feed, ui, { ...rect, height: briefTop - rect.top });
  if (brief) {
    drawBrief(p, data, briefTop + 1, rect);
  }

  if (withPreview) {
    drawPreviewLine(p, previewTop + 1, rect.left + 2, rect.left + rect.width, preview);
    output.slice(-2).forEach((line, index) => {
      p.canvas.put(previewTop + 2 + index, rect.left + 4, '⎿ ', { fg: p.theme.subtle });
      p.canvas.put(previewTop + 2 + index, rect.left + 6, clip(line, rect.width - 6), { fg: p.theme.muted });
    });
  }

  drawLive(p, data, ui, liveTop, rect);
};
