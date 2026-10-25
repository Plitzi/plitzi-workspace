import { clip, textWidth } from './monitorCanvas';
import { hhmm, minutesText, TASK_LOOK, toneOf, VIEWS } from './monitorModel';
import { spentInAll, tokensShort } from './monitorSpend';

import type { MonitorUi, Paint, PreviewShown } from './monitorModel';
import type { Monitored } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';

/** The panel's head — the run, where it stands, the views — and its foot: the status bar and the keys. */

/** The rows the head takes: the run, the views, a breath, the strip. */
export const HEAD_ROWS = 4;

/** The strip's order, left to right: what is approved first, then the work toward it, what is still to do last. */
const STRIP_ORDER: Record<TaskLine['status'], number> = {
  done: 0,
  'in-review': 1,
  'changes-requested': 2,
  'in-progress': 3,
  spike: 4,
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
 * Every task as a block of the strip, ordered by where it stands, its id in it when it fits — the run at a glance. A run
 * with more tasks than the width holds blocks for is said by stage instead, each as wide as its share.
 */
const strip = (p: Paint, tasks: readonly TaskLine[], row: number, width: number): void => {
  const { canvas, theme } = p;
  const ordered = [...tasks].sort((a, b) => STRIP_ORDER[a.status] - STRIP_ORDER[b.status]);
  const span = width - 4;
  const each = ordered.length === 0 ? 0 : Math.floor((span - (ordered.length - 1)) / ordered.length);
  const ground = (task: TaskLine): string => {
    const tone = TASK_LOOK[task.status].tone;

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
  if (ordered.length === 0) {
    canvas.put(row, 2, 'no tasks yet', { fg: theme.subtle });

    return;
  }

  if (each >= 3) {
    let col = 2;
    ordered.forEach((task, index) => {
      const blockWidth = index === ordered.length - 1 ? width - 2 - col : each;
      const look = TASK_LOOK[task.status];
      canvas.fill(row, col, blockWidth, ground(task));
      canvas.put(
        row,
        col + 1,
        clip(`${look.glyph} ${task.id}`, blockWidth - 1),
        {
          fg: toneOf(theme, look.tone),
          bold: true
        },
        col + blockWidth
      );
      col += blockWidth + 1;
    });

    return;
  }

  // Too many to block: each stage as wide as its share, its count in it.
  const stages = [...new Set(ordered.map(task => task.status))];
  let col = 2;
  stages.forEach((status, index) => {
    const count = ordered.filter(task => task.status === status).length;
    const share =
      index === stages.length - 1 ? width - 2 - col : Math.max(1, Math.round((count / ordered.length) * span));
    const look = TASK_LOOK[status];
    const sample = ordered.find(task => task.status === status);
    canvas.fill(row, col, share, sample ? ground(sample) : theme.elevated);
    canvas.put(
      row,
      col + 1,
      clip(`${look.glyph} ${String(count)} ${look.label}`, share - 1),
      {
        fg: toneOf(theme, look.tone),
        bold: true
      },
      col + share
    );
    col += share;
  });
};

export const drawHead = (p: Paint, data: Monitored, ui: MonitorUi, width: number): void => {
  const { canvas, theme, now } = p;
  const { view, stage, runs } = data;
  for (let row = 0; row < HEAD_ROWS; row += 1) {
    canvas.fill(row, 0, width, theme.surface);
  }

  // Right of the first row: the run's state as a pill, the clock, other runs of the project.
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

  // The views, each its key: a tab a click opens too.
  col = 2;
  for (const [index, { view: each, label }] of VIEWS.entries()) {
    const on = ui.view === each;
    const text = ` ${String(index + 1)} ${label} `;
    const from = col;
    col = canvas.put(1, col, text, on ? { fg: theme.text, bg: theme.selection, bold: true } : { fg: theme.subtle });
    p.hits.push({ row: 1, from, to: col, action: { kind: 'view', view: each } });
    col += 1;
  }

  const left = view.expectedEnd
    ? Math.max(0, Math.round((Date.parse(view.expectedEnd) - now.getTime()) / 60_000))
    : undefined;
  const percent = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100);
  const progress = [
    `${String(view.done)} of ${String(view.total)} approved · ${String(percent)}%`,
    ...(view.expectedEnd ? [`ETA ${hhmm(view.expectedEnd)}`] : []),
    ...(left !== undefined && width >= 110 ? [`${minutesText(left)} left`] : [])
  ].join(' · ');
  canvas.right(1, width - 2, progress, { fg: theme.muted });

  strip(p, view.tasks, 3, width);
};

/** The status bar, the screen's last row: the run, its state, what it spent, the preview — and the keys. */
export const drawStatus = (
  p: Paint,
  data: Monitored,
  ui: MonitorUi,
  preview: PreviewShown | undefined,
  width: number,
  row: number
): void => {
  const { canvas, theme } = p;
  const { view } = data;
  canvas.fill(row, 0, width, theme.surface);
  let col = canvas.put(row, 0, ` ${view.runId} `, { fg: '#ffffff', bg: theme.primary, bold: true });
  col = canvas.put(row, col + 1, `● ${view.status}`, { fg: toneOf(theme, STATUS_TONE[view.status] ?? 'subtle') });
  col = canvas.put(row, col + 3, `${String(view.done)}/${String(view.total)}`, { fg: theme.text });
  const spent = spentInAll(data.spend);
  if (spent > 0) {
    col = canvas.put(row, col + 3, `${tokensShort(spent)} tok`, { fg: theme.muted });
  }

  if (preview?.state.kind === 'serving' || preview?.state.kind === 'elsewhere') {
    col = canvas.put(row, col + 3, `● preview ${preview.state.url.replace('http://127.0.0.1', '')}`, {
      fg: theme.success
    });
  }

  if (width >= 120) {
    col = canvas.put(row, col + 3, `plitzi ${theme.name}`, { fg: theme.subtle });
  }

  const keys: [string, string][] =
    width >= 120
      ? [
          ['?', 'help'],
          ['ctrl+p', 'commands'],
          ['p', 'preview'],
          ['q', 'quit']
        ]
      : [
          ['?', 'help'],
          ['ctrl+p', 'commands']
        ];
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
