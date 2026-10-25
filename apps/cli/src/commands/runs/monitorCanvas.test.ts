import { describe, expect, it } from 'vitest';

import { clip, createCanvas, textWidth } from './monitorCanvas';
import { THEMES } from './monitorTheme';

describe("the monitor's canvas", () => {
  it('keeps a character two columns wide whole, and a mark that joins the one before it', () => {
    expect(textWidth('t-home')).toBe(6);
    expect(textWidth('日本')).toBe(4);
    expect(textWidth('é')).toBe(1);
    const canvas = createCanvas(8, 1, THEMES.dark);
    canvas.put(0, 0, 'a日本b');
    expect(canvas.text()).toEqual(['a日本b  ']);
    // A wide character that does not fit is left out, never cut in two.
    canvas.put(0, 6, '日本');
    expect(textWidth(canvas.text()[0] ?? '')).toBe(8);
  });

  it('cuts a line at its room with an ellipsis, never past it', () => {
    expect(clip('after t-home (at work), t-menu', 12)).toBe('after t-hom…');
    expect(clip('short', 12)).toBe('short');
    const canvas = createCanvas(10, 1, THEMES.dark);
    canvas.put(0, 0, 'a line far longer than the canvas');
    expect(canvas.text()[0]).toHaveLength(10);
  });

  // A frame whose top edge was a column short of its bottom: its right side never met.
  it('draws a frame every edge the same width, its title in its top', () => {
    const canvas = createCanvas(30, 5, THEMES.dark);
    canvas.box(0, 2, 26, 5, 'Needs you · 3', THEMES.dark.warning);
    const [top, , , , bottom] = canvas.text();
    expect(top.trimEnd()).toBe(`  ╭─ Needs you · 3 ${'─'.repeat(8)}╮`);
    expect(top.trimEnd().length).toBe(bottom.trimEnd().length);
    expect(
      canvas
        .text()
        .slice(1, 4)
        .every(line => line[2] === '│' && line[27] === '│')
    ).toBe(true);
  });

  it('draws at the depth the terminal draws: every colour, 256, 16 — a link opened by a click', () => {
    const canvas = createCanvas(4, 1, THEMES.dark);
    canvas.put(0, 0, 'ab', { fg: '#7c62f8', link: 'http://127.0.0.1:8300' });
    const [true24] = canvas.ansi(3);
    expect(true24).toContain('38;2;124;98;248');
    expect(true24).toContain('48;2;11;11;17');
    expect(true24).toContain('\x1b]8;;http://127.0.0.1:8300\x1b\\');
    expect(canvas.ansi(2)[0]).toMatch(/38;5;\d+/);
    // 16 colours: no ground painted, a colour of the sixteen.
    expect(canvas.ansi(1)[0]).not.toMatch(/48;/);
    expect(canvas.ansi(1)[0]).toMatch(/\[0;(3|9)\dm/);
    // None (NO_COLOR): what is selected drawn inverse, nothing else coloured.
    const plain = createCanvas(3, 1, THEMES.dark);
    plain.put(0, 0, 'abc', { selected: true });
    expect(plain.ansi(0)[0]).toContain('\x1b[0;7m');
    expect(plain.ansi(0)[0]).not.toMatch(/3\d;|38;/);
  });

  it('lets the board recede under a dialog, the dialog kept as drawn', () => {
    const canvas = createCanvas(6, 3, THEMES.dark);
    canvas.put(0, 0, 'board', { fg: THEMES.dark.text });
    canvas.put(1, 1, 'dlg', { fg: THEMES.dark.text });
    const before = canvas.ansi(3);
    canvas.recede({ top: 1, left: 1, width: 3, height: 1 });
    const after = canvas.ansi(3);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toContain('237;237;243');
  });
});
