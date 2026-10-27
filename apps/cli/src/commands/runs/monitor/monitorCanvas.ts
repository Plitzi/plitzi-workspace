import { colorCodes, mix } from './monitorTheme';

import type { ColorDepth, Theme } from './monitorTheme';

/**
 * The monitor's screen as cells, each a character and how it is drawn — written where things go, then turned into the
 * terminal's lines once, at the depth it draws colours at. What `chalk` strings cut at a width could not do: a surface
 * under a column, a dialog over the board with the board receding under it, a character two columns wide kept whole.
 */

export interface Style {
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Opened by a click in a terminal that knows links (OSC 8): a preview's address. */
  link?: string;
  /** Selected: with no ground to draw it with (16 colours or none), drawn inverse. */
  selected?: boolean;
}

interface Cell {
  ch: string;
  /** The second column of a character two wide: drawn by the one before it. */
  spill?: true;
  style: Style;
}

/** How many columns a character takes: two for the wide (CJK, most emoji), none for a mark that joins the one before. */
export const charWidth = (point: number): 0 | 1 | 2 => {
  if (
    (point >= 0x0300 && point <= 0x036f) ||
    (point >= 0x200b && point <= 0x200f) ||
    (point >= 0x20d0 && point <= 0x20ff) ||
    (point >= 0xfe00 && point <= 0xfe0f)
  ) {
    return 0;
  }

  return (point >= 0x1100 && point <= 0x115f) ||
    (point >= 0x2e80 && point <= 0xa4cf && point !== 0x303f) ||
    (point >= 0xac00 && point <= 0xd7a3) ||
    (point >= 0xf900 && point <= 0xfaff) ||
    (point >= 0xfe30 && point <= 0xfe4f) ||
    (point >= 0xff00 && point <= 0xff60) ||
    (point >= 0xffe0 && point <= 0xffe6) ||
    (point >= 0x1f300 && point <= 0x1f64f) ||
    (point >= 0x1f680 && point <= 0x1f6ff) ||
    (point >= 0x1f900 && point <= 0x1f9ff) ||
    (point >= 0x20000 && point <= 0x3fffd)
    ? 2
    : 1;
};

/** How many columns `text` takes on screen. */
export const textWidth = (text: string): number => {
  let sum = 0;
  for (const char of text) {
    sum += charWidth(char.codePointAt(0) ?? 0);
  }

  return sum;
};

/** `text` in lines of `room` columns at most, broken between words. */
export const wrap = (text: string, room: number): string[] => {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && textWidth(`${line} ${word}`) > room) {
      out.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }

  return [...out, ...(line === '' ? [] : [line])];
};

/** `text` cut to `room` columns, an ellipsis where it was cut: never a character split, never a line pushed down. */
export const clip = (text: string, room: number): string => {
  if (textWidth(text) <= room) {
    return text;
  }

  let kept = '';
  let used = 0;
  for (const char of text) {
    const width = charWidth(char.codePointAt(0) ?? 0);
    if (used + width > room - 1) {
      break;
    }

    kept += char;
    used += width;
  }

  return `${kept.trimEnd()}…`;
};

export interface Canvas {
  width: number;
  height: number;
  /** Writes `text` from `col`, cut at the canvas's edge or at `end`: answers the column after it. */
  put: (row: number, col: number, text: string, style?: Style, end?: number) => number;
  /** Writes `text` ending at `end` (exclusive): a figure aligned right. */
  right: (row: number, end: number, text: string, style?: Style) => number;
  /** Paints `len` columns from `col` with a ground, nothing written on them. */
  fill: (row: number, col: number, len: number, bg: string) => void;
  /** A frame, its title in its top edge: every edge the same width. */
  box: (top: number, left: number, width: number, height: number, title: string, color: string, bg?: string) => void;
  /** Everything but the rectangle recedes toward the ground: what a dialog is opened over. */
  recede: (keep: { top: number; left: number; width: number; height: number }) => void;
  /** A shadow along the right and the bottom of a rectangle: a dialog lifted off the board. */
  shadow: (rect: { top: number; left: number; width: number; height: number }) => void;
  /** The screen as plain text, a line a row, each its width: what a test reads. */
  text: () => string[];
  /** The screen as a terminal draws it, at its depth. */
  ansi: (depth: ColorDepth) => string[];
}

export const createCanvas = (width: number, height: number, theme: Theme): Canvas => {
  const ground: Style = { bg: theme.base, fg: theme.text };
  const rows: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ch: ' ', style: ground }))
  );
  // Without a check of their index, `rows[row]` reads as there for any row: these say when it is not.
  const lineAt = (row: number): Cell[] | undefined => (row >= 0 && row < height ? rows[row] : undefined);
  const cellAt = (row: number, col: number): Cell | undefined =>
    col >= 0 && col < width ? lineAt(row)?.[col] : undefined;

  const put = (row: number, col: number, text: string, style: Style = {}, end = width): number => {
    const line = lineAt(row);
    let at = col;
    for (const char of text) {
      const point = char.codePointAt(0) ?? 0;
      const span = charWidth(point);
      if (span === 0) {
        const before = cellAt(row, at - 1);
        if (before) {
          before.ch += char;
        }

        continue;
      }

      if (at + span > Math.min(end, width)) {
        break;
      }

      const under = cellAt(row, at);
      if (line && under) {
        const cell: Cell = { ch: char, style: { ...under.style, ...style, bg: style.bg ?? under.style.bg } };
        line[at] = cell;
        if (span === 2 && at + 1 < width) {
          line[at + 1] = { ch: '', spill: true, style: cell.style };
        }
      }

      at += span;
    }

    return at;
  };

  const fill = (row: number, col: number, len: number, bg: string): void => {
    const line = lineAt(row);
    if (!line) {
      return;
    }

    for (let at = Math.max(0, col); at < Math.min(width, col + len); at += 1) {
      line[at] = { ch: ' ', style: { bg, fg: theme.text } };
    }
  };

  return {
    width,
    height,
    put,
    right: (row, end, text, style) => put(row, end - textWidth(text), text, style, end),
    fill,
    box: (top, left, boxWidth, boxHeight, title, color, bg) => {
      if (bg !== undefined) {
        for (let row = top; row < top + boxHeight; row += 1) {
          fill(row, left, boxWidth, bg);
        }
      }

      const head = `╭─ ${title} `;
      put(top, left, `${head}${'─'.repeat(Math.max(0, boxWidth - textWidth(head) - 1))}╮`, { fg: color });
      put(top, left + 3, title, { fg: color, bold: true });
      for (let row = top + 1; row < top + boxHeight - 1; row += 1) {
        put(row, left, '│', { fg: color });
        put(row, left + boxWidth - 1, '│', { fg: color });
      }

      put(top + boxHeight - 1, left, `╰${'─'.repeat(Math.max(0, boxWidth - 2))}╯`, { fg: color });
    },
    recede: keep => {
      const toward = theme.name === 'light' ? '#d9d9e3' : '#000000';
      rows.forEach((line, row) =>
        line.forEach((cell, col) => {
          const kept =
            row >= keep.top && row < keep.top + keep.height && col >= keep.left && col < keep.left + keep.width;
          if (!kept) {
            const bg = mix(cell.style.bg ?? theme.base, toward, theme.name === 'light' ? 0.55 : 0.4);
            cell.style = { ...cell.style, bg, fg: mix(cell.style.fg ?? theme.text, bg, 0.7), bold: false };
          }
        })
      );
    },
    shadow: ({ top, left, width: w, height: h }) => {
      const shade = (cell: Cell | undefined) => {
        if (cell) {
          cell.style = {
            ...cell.style,
            bg: mix(cell.style.bg ?? theme.base, '#000000', theme.name === 'light' ? 0.12 : 0.5)
          };
        }
      };
      for (let col = left + 1; col <= left + w; col += 1) {
        shade(cellAt(top + h, col));
      }

      for (let row = top + 1; row < top + h; row += 1) {
        shade(cellAt(row, left + w));
      }
    },
    text: () => rows.map(line => line.map(cell => (cell.spill ? '' : cell.ch)).join('')),
    ansi: depth =>
      rows.map(line => {
        let out = '';
        let last = '';
        let link: string | undefined;
        for (const cell of line) {
          if (cell.spill) {
            continue;
          }

          const { style } = cell;
          const codes = [
            '0',
            ...(style.bold ? ['1'] : []),
            ...(style.underline ? ['4'] : []),
            ...(style.strike ? ['9'] : []),
            ...(depth <= 1 && style.selected ? ['7'] : []),
            ...(style.fg ? [colorCodes(style.fg, depth, false)] : []),
            ...(style.bg && depth >= 2 ? [colorCodes(style.bg, depth, true)] : [])
          ].filter((code): code is string => code !== undefined);
          const sgr = `\x1b[${codes.join(';')}m`;
          if (style.link !== link) {
            out += `\x1b]8;;${style.link ?? ''}\x1b\\`;
            link = style.link;
          }

          if (sgr !== last) {
            out += sgr;
            last = sgr;
          }

          out += cell.ch;
        }

        return `${out}${link === undefined ? '' : '\x1b]8;;\x1b\\'}\x1b[0m`;
      })
  };
};

/**
 * What a terminal is sent to show `next` over `previous`: only the rows that changed, each written where it is — the
 * whole frame when there is none before it or the screen's size changed. Every frame was written whole, eight a second
 * while an agent works, and a terminal that draws as it reads (no synchronized output) flickered with each.
 */
export const frameUpdate = (previous: readonly string[] | undefined, next: readonly string[]): string => {
  if (previous?.length !== next.length) {
    return `\x1b[H${next.join('\r\n')}`;
  }

  return next.map((line, row) => (line === previous[row] ? '' : `\x1b[${String(row + 1)};1H${line}`)).join('');
};
