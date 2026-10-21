import { stripVTControlCharacters } from 'node:util';

/** The monitor's cells: a line fit to its width, a time, an id in its column. */

export const hhmm = (iso: string): string => iso.slice(11, 16);

export const visible = (line: string): number => stripVTControlCharacters(line).length;

/** A line cut, or padded, to `width` columns, colours kept — a longer one would wrap and push the screen down. */
export const cell = (line: string, width: number): string => {
  const length = visible(line);
  if (length <= width) {
    return line + ' '.repeat(width - length);
  }

  return `${stripVTControlCharacters(line).slice(0, Math.max(0, width - 1))}…`;
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
