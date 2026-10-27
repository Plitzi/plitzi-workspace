import { needsOf } from './monitorAttention';
import { clip, textWidth } from './monitorCanvas';

import type { Need } from './monitorAttention';
import type { MonitorUi, Paint } from './monitorModel';
import type { Monitored } from '../../../runs/view/monitor';

/**
 * What needs someone, as the panel asks it: one notice at a time in a frame of its own over the status bar — the one
 * frame of the screen, as Claude Code asks before it acts — with what answers it a key away: all of them whole (d), the
 * command it names copied (c), the next (n), later (esc). A notice that is the lead's to act on is said as the lead's: the
 * person watching knows, the run does not wait on them.
 */

/**
 * The notices the box goes through: those not put off, the most pressing first — simple, only the person's own: what
 * is the lead's to act on is counted in the status bar (`leadsOnly`), and shown advanced.
 */
export const shownNeeds = (data: Monitored, ui: MonitorUi): Need[] =>
  needsOf(data.view).filter(need => !ui.dismissed.has(need.key) && (ui.mode === 'advanced' || need.person));

/** How many notices the simple panel leaves to the lead: counted, not shown. */
export const leadsOnly = (data: Monitored, ui: MonitorUi): number =>
  ui.mode === 'simple' ? needsOf(data.view).filter(need => !ui.dismissed.has(need.key) && !need.person).length : 0;

/** The rows the box takes at this height: none with nothing to say, three on a short terminal, five otherwise. */
export const needsRows = (needs: readonly Need[], height: number): number =>
  needs.length === 0 ? 0 : height < 26 ? 3 : 5;

/** A key and what it does, as the box and the dialogs show them. */
export const keyHint = (p: Paint, row: number, col: number, key: string, label: string, bg?: string): number => {
  const { canvas, theme } = p;
  const after = canvas.put(row, col, ` ${key} `, { fg: theme.text, bg: bg ?? theme.elevated, bold: true });

  return canvas.put(row, after + 1, label, { fg: theme.muted }) + 3;
};

export const drawNeeds = (
  p: Paint,
  needs: readonly Need[],
  ui: MonitorUi,
  top: number,
  rows: number,
  width: number
): void => {
  if (rows === 0) {
    return;
  }

  const { canvas, theme } = p;
  const at = Math.min(ui.needsAt, needs.length - 1);
  const need = needs.at(at);
  if (!need) {
    return;
  }

  const forPerson = needs.some(each => each.person);
  const color = forPerson ? theme.danger : theme.warning;
  const boxWidth = width - 4;
  canvas.box(top, 2, boxWidth, rows, `${forPerson ? 'Needs you' : 'For the lead'} · ${String(needs.length)}`, color);
  const end = 2 + boxWidth - 2;
  const counter = needs.length > 1 ? `${String(at + 1)} of ${String(needs.length)}` : '';
  canvas.right(top + 1, end, counter, { fg: theme.subtle });
  let col = canvas.put(top + 1, 4, '▲ ', { fg: need.person ? theme.danger : theme.warning, bold: true });
  col = canvas.put(top + 1, col, need.sort, { fg: theme.text, bold: true });
  if (need.task) {
    col = canvas.put(top + 1, col + 2, need.task, { fg: theme.link });
  }

  if (need.agent) {
    col = canvas.put(top + 1, col + 1, need.agent, { fg: p.hues.get(need.agent) ?? theme.muted, bold: true });
  }

  const sayTo = end - textWidth(counter) - 2;
  if (rows === 3) {
    // Short: what it says, then its keys, on the one row.
    const keys = ' d more  n next';
    canvas.put(top + 1, col + 2, clip(need.said, Math.max(0, sayTo - col - 2 - textWidth(keys))), { fg: theme.muted });
    canvas.right(top + 1, sayTo, keys, { fg: theme.subtle });

    return;
  }

  canvas.put(top + 1, col + 2, clip(`— ${need.said}`, Math.max(0, sayTo - col - 2)), { fg: theme.muted }, sayTo);
  const rest = needs.filter(each => each !== need).map(each => (each.task ? `${each.sort} (${each.task})` : each.sort));
  if (rest.length > 0) {
    canvas.put(top + 2, 6, clip(`Then: ${rest.join(' · ')}`, boxWidth - 8), { fg: theme.subtle });
  }

  // Each key while it fits in the frame: the fix's command cut first, then the keys from the last.
  const keys: [string, string][] = [
    ['d', 'details'],
    ...(need.fix ? ([['c', `copy the fix  ${need.fix}`]] as [string, string][]) : []),
    ...(needs.length > 1 ? ([['n', 'next']] as [string, string][]) : []),
    ['esc', 'later']
  ];
  const tail = keys
    .filter(([key]) => key !== 'c')
    .reduce((sum, [key, label]) => sum + textWidth(key) + textWidth(label) + 6, 0);
  col = 6;
  for (const [key, label] of keys) {
    const room = end - col - (key === 'c' ? tail : 0);
    const fitted = key === 'c' ? clip(label, Math.max(12, room - 6)) : label;
    if (col + textWidth(key) + textWidth(fitted) + 3 > end) {
      break;
    }

    col = keyHint(p, top + 3, col, key, fitted);
  }
};
