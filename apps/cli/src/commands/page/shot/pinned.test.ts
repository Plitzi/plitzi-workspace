// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canvasDrawn,
  HIDDEN_FOR_SHOT,
  hidePinned,
  largestCanvas,
  lockedScreen,
  pinnedScroll,
  showPinned
} from './capture';

import type { BrowserPage } from '../../../browser';

// A part clipped under a sticky site header was pictured with the header over its first rows — and, hidden by its
// visibility, a header whose children keep `visibility: visible` of their own still drew them (a run's looks at 390).
describe('what is pinned over an element pictured', () => {
  it('is hidden for the picture, all it holds too — never the element, what holds it or what it holds — and shown again as it was', () => {
    document.body.innerHTML = `
      <header id="bar" style="position: sticky; top: 0"><nav id="nav" style="visibility: visible"></nav></header>
      <div id="toast" style="position: fixed; opacity: 0.8"></div>
      <main id="sheet" style="position: fixed"><section id="queue"><div id="pin" style="position: sticky"></div></section></main>`;
    const queue = document.getElementById('queue');
    if (!queue) {
      throw new Error('no queue');
    }

    expect(hidePinned(queue, HIDDEN_FOR_SHOT)).toBe(2);
    // By its opacity, which nothing it holds can undo.
    expect(document.getElementById('bar')?.style.getPropertyValue('opacity')).toBe('0');
    expect(document.getElementById('bar')?.style.getPropertyPriority('opacity')).toBe('important');
    expect(document.getElementById('toast')?.style.getPropertyValue('opacity')).toBe('0');
    expect(document.getElementById('sheet')?.style.getPropertyValue('opacity')).toBe('');
    expect(document.getElementById('pin')?.style.getPropertyValue('opacity')).toBe('');

    showPinned(HIDDEN_FOR_SHOT);
    expect(document.getElementById('bar')?.style.getPropertyValue('opacity')).toBe('');
    expect(document.getElementById('toast')?.style.getPropertyValue('opacity')).toBe('0.8');
    expect(document.querySelectorAll(`[${HIDDEN_FOR_SHOT}]`)).toHaveLength(0);
  });
});

// The room's stats sheet scrolls inside itself; its lower blocks never showed in a whole-page picture.
describe('a sheet pinned over the page that scrolls on its own', () => {
  const sized = (id: string, box: { scrollHeight: number; clientHeight: number; width: number }) => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`no ${id}`);
    }

    Object.defineProperty(element, 'scrollHeight', { value: box.scrollHeight });
    Object.defineProperty(element, 'clientHeight', { value: box.clientHeight });
    element.getBoundingClientRect = () => DOMRect.fromRect({ width: box.width, height: box.clientHeight });
  };

  it('says how much more it holds than it shows — only one pinned to the screen, and wide', () => {
    document.body.innerHTML = `
      <div style="position: fixed"><div id="sheet" style="overflow-y: auto"></div></div>
      <div id="list" style="overflow-y: auto"></div>
      <div style="position: fixed"><div id="menu" style="overflow-y: auto"></div></div>`;
    sized('sheet', { scrollHeight: 2400, clientHeight: 800, width: window.innerWidth });
    sized('list', { scrollHeight: 5000, clientHeight: 800, width: window.innerWidth });
    sized('menu', { scrollHeight: 4000, clientHeight: 300, width: 100 });

    expect(pinnedScroll()).toBe(1600);
  });

  // A run's stats sheet, let grow to what it holds by the whole-page walk: fixed, and past the screen's foot.
  it('says how far a sheet pinned to the screen reaches past its foot', () => {
    document.body.innerHTML = '<aside id="sheet" style="position: fixed"></aside>';
    const sheet = document.getElementById('sheet');
    if (!sheet) {
      throw new Error('no sheet');
    }

    sheet.getBoundingClientRect = () =>
      DOMRect.fromRect({ y: 0, width: window.innerWidth, height: window.innerHeight + 559 });

    expect(pinnedScroll()).toBe(559);

    // Held to the screen by its insets, its rows spilling out of it.
    sheet.getBoundingClientRect = () =>
      DOMRect.fromRect({ y: 0, width: window.innerWidth, height: window.innerHeight });
    Object.defineProperty(sheet, 'scrollHeight', { value: 1359 });
    Object.defineProperty(sheet, 'clientHeight', { value: 800 });
    expect(pinnedScroll()).toBe(559);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

// A HUD's bar, set absolutely over its column, drew over the top of every part a look pictured inside it.
describe('what is placed over an element pictured', () => {
  it('is hidden when its box is on the element, and left when it is elsewhere', () => {
    document.body.innerHTML = `
      <div id="hud"><div id="bar" style="position: absolute"></div><div id="badge" style="position: absolute"></div>
      <section id="panel"></section></div>`;
    const boxes: Record<string, [number, number, number, number]> = {
      bar: [0, 0, 1440, 140],
      badge: [1200, 600, 40, 40],
      panel: [22, 120, 300, 400]
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const [left, top, width, height] = boxes[this.id] ?? [0, 0, 0, 0];

      return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect;
    });
    const panel = document.getElementById('panel');
    if (!panel) {
      throw new Error('no panel');
    }

    expect(hidePinned(panel, HIDDEN_FOR_SHOT)).toBe(1);
    expect(document.getElementById('bar')?.style.getPropertyValue('opacity')).toBe('0');
    expect(document.getElementById('badge')?.style.getPropertyValue('opacity')).toBe('');
    showPinned(HIDDEN_FOR_SHOT);
  });
});

// A HUD locked to its screen was pictured unrolled: its log, which scrolls in its panel, read as one spilling over a
// 2,092 px page.
describe('a page locked to its screen', () => {
  it('is read as the screen it is, and a page whose document scrolls as none', () => {
    expect(lockedScreen()).toBeUndefined();

    document.head.innerHTML = '<style>html, body { overflow-y: hidden }</style>';
    expect(lockedScreen()).toBe(window.innerHeight);
  });
});

// A run's look set a globe the run before had not drawn yet beside its own, and read "13.4% differs".
describe('a canvas pictured', () => {
  /** A page with one canvas whose looks differ by these shares, one after another: what `canvasDrawn` reads of it. */
  const pageDrawing = (changes: number[], canvas = true) => {
    const looks: number[] = [];
    const page = {
      evaluate: (fn: unknown) =>
        Promise.resolve(
          fn === largestCanvas
            ? canvas
              ? { x: 0, y: 0, width: 600, height: 600 }
              : undefined
            : { changed: changes.at(looks.push(0) - 1) ?? 0, regions: [] }
        ),
      screenshot: () => Promise.resolve(new Uint8Array(24)),
      waitForTimeout: () => Promise.resolve()
    };

    // The fake answers what a wait for a canvas calls of a page, and nothing else a page has.
    return { page: page as unknown as BrowserPage, looks };
  };

  it('is waited for until two looks barely differ — never when the page draws none', async () => {
    const drawing = pageDrawing([40, 12, 1]);
    expect(await canvasDrawn(drawing.page)).toBe(true);
    expect(drawing.looks).toHaveLength(3);

    const none = pageDrawing([40], false);
    expect(await canvasDrawn(none.page)).toBe(true);
    expect(none.looks).toHaveLength(0);
  });
});
