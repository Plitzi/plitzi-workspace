// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { HIDDEN_FOR_SHOT, hidePinned, pinnedScroll, showPinned } from './capture';

// encore-4: a part clipped under a sticky site header was pictured with the header over its first rows.
describe('what is pinned over an element pictured', () => {
  it('is hidden for the picture — never the element, what holds it or what it holds — and shown again as it was', () => {
    document.body.innerHTML = `
      <header id="bar" style="position: sticky; top: 0"></header>
      <div id="toast" style="position: fixed; visibility: visible"></div>
      <main id="sheet" style="position: fixed"><section id="queue"><div id="pin" style="position: sticky"></div></section></main>`;
    const queue = document.getElementById('queue');
    if (!queue) {
      throw new Error('no queue');
    }

    expect(hidePinned(queue, HIDDEN_FOR_SHOT)).toBe(2);
    expect(document.getElementById('bar')?.style.visibility).toBe('hidden');
    expect(document.getElementById('sheet')?.style.visibility).toBe('');
    expect(document.getElementById('pin')?.style.visibility).toBe('');

    showPinned(HIDDEN_FOR_SHOT);
    expect(document.getElementById('bar')?.style.visibility).toBe('');
    expect(document.getElementById('toast')?.style.visibility).toBe('visible');
    expect(document.querySelectorAll(`[${HIDDEN_FOR_SHOT}]`)).toHaveLength(0);
  });
});

// encore-4: the room's stats sheet scrolls inside itself; its lower blocks never showed in a whole-page picture.
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

  // encore-4's stats sheet, let grow to what it holds by the whole-page walk: fixed, and past the screen's foot.
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
