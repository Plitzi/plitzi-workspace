import { stripVTControlCharacters } from 'node:util';

import type { TaskLine } from '../../runs/view';

/** The monitor's cells: a line fit to its width, a time, an id in its column. */

export const hhmm = (iso: string): string => iso.slice(11, 16);

export const visible = (line: string): number => stripVTControlCharacters(line).length;

/** A colour or style sequence (SGR), as `chalk` writes them: kept whole when a line is cut. */
// eslint-disable-next-line no-control-regex -- a style sequence starts with ESC: it is what is matched
const STYLE = /^\x1b\[[0-9;]*m/;

/**
 * A line cut, or padded, to `width` columns, colours kept — a longer one would wrap and push the screen down. Cut, its
 * styles go on to where it ends and are reset there: a card cut short is still its stage's colour, never plain.
 */
export const cell = (line: string, width: number): string => {
  const length = visible(line);
  if (length <= width) {
    return line + ' '.repeat(width - length);
  }

  const room = Math.max(0, width - 1);
  let kept = '';
  let shown = 0;
  let styled = false;
  for (let at = 0; at < line.length && shown < room;) {
    const style = STYLE.exec(line.slice(at))?.[0];
    if (style !== undefined) {
      kept += style;
      styled = true;
      at += style.length;
      continue;
    }

    // A character whole — a pair of surrogates never split — counted as `visible` counts it.
    const char = String.fromCodePoint(line.codePointAt(at) ?? 0);
    kept += char;
    shown += char.length;
    at += char.length;
  }

  return `${kept}…${styled ? '\x1b[0m' : ''}`;
};

export const ago = (iso: string | undefined, now: Date): string => {
  if (iso === undefined) {
    return '';
  }

  const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60_000);

  return minutes < 1 ? 'now' : `${String(minutes)}m ago`;
};

export const ID_WIDTH = 22;

/** An id in its column: a long one (an integration's, named by its file) cut in the middle, both ends kept. */
export const idCell = (id: string, width = ID_WIDTH): string => {
  if (id.length <= width) {
    return id.padEnd(width);
  }

  const head = Math.ceil((width - 1) / 2);

  return `${id.slice(0, head)}…${id.slice(-(width - 1 - head))}`;
};

/** Items joined into lines that fit `width`, each line as many as fit: what would be cut on a narrow terminal, wrapped. */
export const wrapped = (items: readonly string[], width: number, separator = ' · '): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const item of items) {
    const next = line === '' ? item : `${line}${separator}${item}`;
    if (line !== '' && visible(next) > width) {
      lines.push(line);
      line = item;
    } else {
      line = next;
    }
  }

  return [...lines, ...(line === '' ? [] : [line])].map(each => cell(each, width));
};

/**
 * A task's urgency as a mark of one column: `‼` critical, `!` high — its own priority or that of what waits on it —
 * blank otherwise, and once it is approved: what to look at first, in the list and in the flow alike.
 */
export const urgencyMark = (task: Pick<TaskLine, 'urgency' | 'status'>): string =>
  task.status === 'done' ? ' ' : task.urgency === 'critical' ? '‼' : task.urgency === 'high' ? '!' : ' ';
