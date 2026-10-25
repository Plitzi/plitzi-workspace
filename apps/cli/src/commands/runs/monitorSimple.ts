import { clip, textWidth } from './monitorCanvas';
import { EVENT_TONE, whatOf } from './monitorFeed';
import { briefStages } from './monitorFlow';
import { AGENT_LOOK, hhmm, LIVE_VERB, since, TASK_LOOK, toneOf } from './monitorModel';
import { drawWho, shimmer, SPINNER } from './monitorOverview';
import { drawPreviewLine } from './monitorSide';

import type { MonitorUi, Paint, PreviewShown, Tone } from './monitorModel';
import type { Rect } from './monitorSide';
import type { AgentStatus, Monitored } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';

/**
 * The simple panel: only what a person acts on, in the order they look for it — who is at what now, where the tasks
 * stand and which are stuck, the preview, and what happened last. The views, the whole activity, the spend and the
 * models are the advanced panel's (`m`).
 */

/** The stuck tasks named at most: the rest are counted in their stage. */
const STUCK_MOST = 3;

/** The rows the latest events keep at least, however many agents are at work. */
const LATEST_LEAST = 3;

const section = (p: Paint, row: number, rect: Rect, title: string, aside?: string): void => {
  const end = p.canvas.put(row, rect.left + 2, title, { fg: p.theme.text, bold: true });
  if (aside !== undefined) {
    p.canvas.put(row, end + 2, clip(aside, Math.max(0, rect.left + rect.width - end - 4)), { fg: p.theme.subtle });
  }
};

/** Each agent at work, a row: its spinner, its verb, its task and what the task is, how long. The rest in a line. */
const drawWorking = (p: Paint, data: Monitored, ui: MonitorUi, top: number, rect: Rect, most: number): number => {
  const { canvas, theme, now } = p;
  const end = rect.left + rect.width - 2;
  const live = data.agents.filter(agent => LIVE_VERB[agent.status] !== undefined);
  section(p, top, rect, 'Working now');
  let row = top + 1;
  if (live.length === 0) {
    canvas.put(row, rect.left + 4, 'No agent is at work now.', { fg: theme.subtle });
    row += 1;
  }

  const shown = live.slice(0, most);
  const nameWidth = Math.min(12, Math.max(4, ...shown.map(agent => textWidth(agent.agent))));
  shown.forEach((agent, index) => {
    const task = data.view.tasks.find(each => each.id === agent.task);
    const tone = AGENT_LOOK[agent.status].tone;
    canvas.put(row, rect.left + 4, SPINNER[(ui.frame + index * 3) % SPINNER.length] ?? '✻', {
      fg: toneOf(theme, tone),
      bold: true
    });
    canvas.put(row, rect.left + 6, clip(agent.agent, nameWidth), {
      fg: p.hues.get(agent.agent) ?? theme.text,
      bold: true
    });
    // An agent at no task — the lead between reviews — works at what it says it does.
    const verb = agent.task === undefined && agent.status === 'working' ? 'Working' : (LIVE_VERB[agent.status] ?? '');
    let col = shimmer(p, row, rect.left + 8 + nameWidth, `${verb}…`, ui.frame + index * 4, tone);
    if (agent.task !== undefined) {
      col = canvas.put(row, col + 1, agent.task, { fg: theme.link });
    }

    const elapsed = since(task?.takenAt ?? agent.signalAt, now);
    const timeAt = end - textWidth(elapsed);
    const what = agent.status === 'asking' ? (task?.asking?.text ?? agent.doing) : (task?.title ?? agent.doing);
    canvas.put(row, col + 2, clip(what, Math.max(0, timeAt - col - 4)), { fg: theme.muted });
    canvas.put(row, timeAt, elapsed, { fg: theme.subtle });
    row += 1;
  });

  // The others by where they stand, in a line: who is free, who stopped.
  const others = new Map<AgentStatus, string[]>();
  for (const agent of data.agents.filter(each => LIVE_VERB[each.status] === undefined)) {
    others.set(agent.status, [...(others.get(agent.status) ?? []), agent.agent]);
  }

  const more = live.length - shown.length;
  // Each part in the tone of where it stands: a stopped agent reads apart from a free one at a glance.
  const rest: { text: string; tone: Tone }[] = [
    ...(more > 0 ? [{ text: `+${String(more)} more at work`, tone: 'primary' as const }] : []),
    ...[...others].map(([status, names]) => ({
      text: `${AGENT_LOOK[status].label}: ${names.join(', ')}`,
      tone: AGENT_LOOK[status].tone
    }))
  ];
  if (rest.length > 0) {
    const end = rect.left + rect.width - 2;
    let col = rect.left + 4;
    rest.forEach(({ text, tone }, index) => {
      if (index > 0) {
        col = canvas.put(row, col, ' · ', { fg: theme.subtle }, end);
      }

      col = canvas.put(row, col, clip(text, Math.max(0, end - col)), { fg: toneOf(theme, tone) }, end);
    });
    row += 1;
  }

  return row;
};

/** The tasks a person may have to unblock: blocked, or failed. */
const stuckTasks = (data: Monitored): TaskLine[] =>
  data.view.tasks.filter(task => task.status === 'blocked' || task.status === 'failed');

/** How many tasks are at each stage, in a line — and the stuck ones by name, with why. */
const drawTasks = (p: Paint, data: Monitored, top: number, rect: Rect): number => {
  const { canvas, theme } = p;
  const end = rect.left + rect.width - 2;
  section(p, top, rect, 'Tasks');
  let col = rect.left + 4;
  for (const stage of briefStages(data.view.tasks).filter(each => each.tasks.length > 0)) {
    const text = `${stage.glyph} ${String(stage.tasks.length)} ${stage.title.toLowerCase()}`;
    if (col + textWidth(text) > end) {
      break;
    }

    col = canvas.put(top + 1, col, text, { fg: toneOf(theme, stage.tone) }) + 3;
  }

  let row = top + 2;
  for (const task of stuckTasks(data).slice(0, STUCK_MOST)) {
    const look = TASK_LOOK[task.status];
    const at = canvas.put(row, rect.left + 4, `${look.glyph} ${task.id}`, { fg: toneOf(theme, look.tone), bold: true });
    canvas.put(row, at + 2, clip(task.blockedBy?.reason ?? look.label, Math.max(0, end - at - 2)), { fg: theme.muted });
    row += 1;
  }

  return row;
};

/** The latest events, the newest first: when, who, the task, what — none opened, the whole is the advanced panel's. */
const drawLatest = (p: Paint, data: Monitored, top: number, rect: Rect, rows: number): void => {
  const { canvas, theme } = p;
  const end = rect.left + rect.width - 2;
  section(p, top, rect, 'Latest', data.feed.length > rows ? 'm shows the whole activity' : undefined);
  data.feed.slice(0, rows).forEach((line, index) => {
    const row = top + 1 + index;
    canvas.put(row, rect.left + 4, hhmm(line.at), { fg: theme.subtle });
    canvas.put(row, rect.left + 10, '●', { fg: toneOf(theme, EVENT_TONE[line.kind]) });
    let col = drawWho(p, row, rect.left + 12, line);
    if (line.task !== undefined) {
      col = canvas.put(row, col + 2, line.task, { fg: theme.link });
    }

    canvas.put(row, col + 2, clip(whatOf(line), Math.max(0, end - col - 2)), { fg: theme.text });
  });
};

export const drawSimple = (p: Paint, data: Monitored, ui: MonitorUi, preview: PreviewShown, rect: Rect): void => {
  const { canvas, theme } = p;
  const output = preview.state.kind === 'stopped' ? preview.state.said : preview.output;
  const previewRows = 1 + Math.min(1, output.length);
  const taskRows = 2 + Math.min(STUCK_MOST, stuckTasks(data).length);
  // What the sections take besides the agents at work: their titles, the gaps between them, the latest at least.
  const fixed = 2 + taskRows + 1 + previewRows + 1 + 1 + LATEST_LEAST;
  const most = Math.max(1, rect.height - fixed);

  let row = drawWorking(p, data, ui, rect.top, rect, most) + 1;
  row = drawTasks(p, data, row, rect) + 1;
  drawPreviewLine(p, row, rect.left + 2, rect.left + rect.width - 2, preview);
  output.slice(-1).forEach(line => {
    canvas.put(row + 1, rect.left + 4, '⎿ ', { fg: theme.subtle });
    canvas.put(row + 1, rect.left + 6, clip(line, rect.width - 8), { fg: theme.muted });
  });
  row += previewRows + 1;
  drawLatest(p, data, row, rect, Math.max(0, rect.top + rect.height - row - 1));
};
