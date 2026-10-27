import { clip, textWidth } from './monitorCanvas';
import { hhmm, minutesText, TASK_LOOK, toneOf, VIEWS } from './monitorModel';
import { spentInAll, tokensShort } from './monitorSpend';
import { costInAll, costShort } from '../../runs/spent';

import type { MonitorMode, MonitorUi, Paint, PreviewShown } from './monitorModel';
import type { Monitored } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';

/** The panel's head — the run, where it stands, the views — and its foot: the status bar and the keys. */

/** The rows the head takes: the run, the views, a breath, the strip — simple, the run and its progress, a breath. */
export const headRows = (mode: MonitorMode): number => (mode === 'simple' ? 3 : 4);

/** The strip's order, left to right after the approved: the work toward approval, what is still to do last. */
const STRIP_ORDER: Record<TaskLine['status'], number> = {
  done: 0,
  'in-review': 1,
  'changes-requested': 2,
  'in-progress': 3,
  waiting: 5,
  blocked: 5,
  failed: 5,
  ready: 6,
  pending: 7
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'subtle'> = {
  open: 'success',
  stopping: 'warning',
  stopped: 'subtle',
  reconciliation: 'danger',
  finished: 'subtle'
};

/**
 * The strip: the approved as one block, `✓ 12 approved`, then every task still to approve a block of its own, its id in
 * it when it fits — the run at a glance. A block each for the approved left the work under way a sliver at the right
 * once most of a run was done (Carlos: the monitor "termina siendo inútil"). More to approve than the width holds
 * blocks for are said by stage instead, each as wide as its share.
 */
const strip = (p: Paint, tasks: readonly TaskLine[], row: number, width: number): void => {
  const { canvas, theme } = p;
  if (tasks.length === 0) {
    canvas.put(row, 2, 'no tasks yet', { fg: theme.subtle });

    return;
  }

  const ground = (status: TaskLine['status']): string => {
    const tone = TASK_LOOK[status].tone;

    return tone === 'success'
      ? theme.successBg
      : tone === 'info'
        ? theme.infoBg
        : tone === 'link'
          ? theme.selection
          : tone === 'warning'
            ? theme.warningBg
            : tone === 'danger'
              ? theme.dangerBg
              : theme.elevated;
  };
  const block = (col: number, blockWidth: number, status: TaskLine['status'], text: string): number => {
    const look = TASK_LOOK[status];
    canvas.fill(row, col, blockWidth, ground(status));
    canvas.put(
      row,
      col + 1,
      clip(text, blockWidth - 1),
      { fg: toneOf(theme, look.tone), bold: true },
      col + blockWidth
    );

    return col + blockWidth + 1;
  };
  const approved = tasks.filter(task => task.status === 'done').length;
  const left = tasks
    .filter(task => task.status !== 'done')
    .sort((a, b) => STRIP_ORDER[a.status] - STRIP_ORDER[b.status]);
  const end = width - 2;
  const approvedText = `${TASK_LOOK.done.glyph} ${String(approved)} approved`;
  let col = 2;
  if (approved > 0) {
    col = block(col, left.length === 0 ? end - col : textWidth(approvedText) + 2, 'done', approvedText);
  }

  if (left.length === 0) {
    return;
  }

  const span = end - col;
  const each = Math.floor((span - (left.length - 1)) / left.length);
  if (each >= 3) {
    left.forEach((task, index) => {
      col = block(
        col,
        index === left.length - 1 ? end - col : each,
        task.status,
        `${TASK_LOOK[task.status].glyph} ${task.id}`
      );
    });

    return;
  }

  // Too many to block: each stage as wide as its share, its count in it.
  const stages = [...new Set(left.map(task => task.status))];
  stages.forEach((status, index) => {
    const count = left.filter(task => task.status === status).length;
    const share = index === stages.length - 1 ? end - col : Math.max(1, Math.round((count / left.length) * span));
    col = block(col, share, status, `${TASK_LOOK[status].glyph} ${String(count)} ${TASK_LOOK[status].label}`) - 1;
  });
};

/** The head's first row: the brand, the run, its stage and goal — on the right, its state and the clock. */
const drawTitle = (p: Paint, data: Monitored, width: number): void => {
  const { canvas, theme, now } = p;
  const { view, stage, runs } = data;
  const clock = `${hhmm(now.toISOString())} UTC`;
  const state = ` ● ${view.status.toUpperCase()} `;
  const tone = toneOf(theme, STATUS_TONE[view.status] ?? 'subtle');
  let right = width - 2 - textWidth(clock);
  canvas.put(0, right, clock, { fg: theme.subtle });
  right -= textWidth(state) + 2;
  canvas.put(0, right, state, {
    fg: tone,
    bg: view.status === 'open' ? theme.successBg : view.status === 'stopping' ? theme.warningBg : theme.elevated,
    bold: true
  });
  const others = runs.filter(run => run.runId !== view.runId);
  if (others.length > 0) {
    const said = `+${String(others.length)} other run${others.length === 1 ? '' : 's'}`;
    right -= textWidth(said) + 2;
    canvas.put(0, right, said, { fg: theme.subtle });
  }

  let col = canvas.put(0, 2, '◆ plitzi', { fg: theme.primary, bold: true });
  col = canvas.put(0, col + 3, view.runId, { fg: theme.text, bold: true });
  if (stage) {
    col = canvas.put(0, col + 2, ` stage ${String(stage.of)} · ${stage.name} `, {
      fg: theme.link,
      bg: theme.selection
    });
  }

  if (view.scopedBefore) {
    col = canvas.put(0, col + 2, 'scoped before the run', { fg: theme.subtle });
  }

  canvas.put(0, col + 2, clip(stage?.goal ?? view.goal, Math.max(0, right - col - 4)), { fg: theme.muted }, right - 2);
};

/** How far the run is, in words: approved of all, the share, when it is expected to end and how long that is. */
const progressText = (data: Monitored, now: Date, width: number): string => {
  const { view } = data;
  const left = view.expectedEnd
    ? Math.max(0, Math.round((Date.parse(view.expectedEnd) - now.getTime()) / 60_000))
    : undefined;
  const percent = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100);

  return [
    `${String(view.done)} of ${String(view.total)} approved · ${String(percent)}%`,
    ...(view.expectedEnd ? [`ETA ${hhmm(view.expectedEnd)}`] : []),
    ...(left !== undefined && width >= 110 ? [`${minutesText(left)} left`] : [])
  ].join(' · ');
};

/** The simple head's progress: a bar as long as the run, filled as far as it is approved, and the words beside it. */
const drawBar = (p: Paint, data: Monitored, row: number, width: number): void => {
  const { canvas, theme, now } = p;
  const { view } = data;
  const bar = Math.max(10, Math.min(48, Math.floor(width / 3)));
  const filled = view.total === 0 ? 0 : Math.round((view.done / view.total) * bar);
  canvas.put(row, 2, '━'.repeat(filled), { fg: theme.success });
  canvas.put(row, 2 + filled, '━'.repeat(bar - filled), { fg: theme.border });
  canvas.put(row, 4 + bar, clip(progressText(data, now, width), Math.max(0, width - bar - 6)), { fg: theme.text });
};

export const drawHead = (p: Paint, data: Monitored, ui: MonitorUi, width: number): void => {
  const { canvas, theme, now } = p;
  for (let row = 0; row < headRows(ui.mode); row += 1) {
    canvas.fill(row, 0, width, theme.surface);
  }

  drawTitle(p, data, width);
  if (ui.mode === 'simple') {
    drawBar(p, data, 1, width);

    return;
  }

  // The views, each its key: a tab a click opens too.
  let col = 2;
  for (const [index, { view: each, label }] of VIEWS.entries()) {
    const on = ui.view === each;
    const text = ` ${String(index + 1)} ${label} `;
    const from = col;
    col = canvas.put(1, col, text, on ? { fg: theme.text, bg: theme.selection, bold: true } : { fg: theme.subtle });
    p.hits.push({ row: 1, from, to: col, action: { kind: 'view', view: each } });
    col += 1;
  }

  canvas.right(1, width - 2, progressText(data, now, width), { fg: theme.muted });
  strip(p, data.view.tasks, 3, width);
};

/** The status bar, the screen's last row: the run, its state, what it spent, the preview — and the keys. */
export const drawStatus = (
  p: Paint,
  data: Monitored,
  ui: MonitorUi,
  preview: PreviewShown | undefined,
  width: number,
  row: number,
  forLead: number
): void => {
  const { canvas, theme } = p;
  const { view } = data;
  canvas.fill(row, 0, width, theme.surface);
  let col = canvas.put(row, 0, ` ${view.runId} `, { fg: '#ffffff', bg: theme.primary, bold: true });
  col = canvas.put(row, col + 1, `● ${view.status}`, { fg: toneOf(theme, STATUS_TONE[view.status] ?? 'subtle') });
  col = canvas.put(row, col + 3, `${String(view.done)}/${String(view.total)}`, { fg: theme.text });
  const spent = spentInAll(data.spend);
  const cost = costInAll(data.spend);
  if (cost !== undefined) {
    col = canvas.put(row, col + 3, costShort(cost), { fg: theme.text });
  }

  if (spent > 0) {
    col = canvas.put(row, col + 3, `${tokensShort(spent)} tok`, { fg: theme.muted });
  }

  if (preview?.state.kind === 'serving' || preview?.state.kind === 'elsewhere') {
    col = canvas.put(row, col + 3, `● preview ${preview.state.url.replace('http://127.0.0.1', '')}`, {
      fg: theme.success
    });
  }

  if (forLead > 0) {
    col = canvas.put(row, col + 3, `${String(forLead)} for the lead`, { fg: theme.warning });
  }

  if (width >= 120) {
    col = canvas.put(row, col + 3, `plitzi ${theme.name}`, { fg: theme.subtle });
  }

  const other: [string, string] = ['m', ui.mode === 'simple' ? 'advanced' : 'simple'];
  const keys: [string, string][] =
    width >= 120
      ? [other, ['p', 'start preview'], ['x', 'stop it'], ['?', 'help'], ['q', 'quit']]
      : [other, ['?', 'help']];
  let end = width - 2;
  for (const [key, label] of [...keys].reverse()) {
    end -= textWidth(label);
    canvas.put(row, end, label, { fg: theme.subtle });
    end -= textWidth(key) + 1;
    canvas.put(row, end, key, { fg: theme.text, bold: true });
    end -= 3;
  }

  // What a key just did, said for a moment between the two.
  if (ui.flash !== undefined) {
    canvas.put(row, col + 3, clip(ui.flash, Math.max(0, end - col - 4)), { fg: theme.warning, bold: true }, end);
  }
};
