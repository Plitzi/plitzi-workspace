// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stateOf } from './playState';

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom runs no animation and has no `getAnimations`: a page whose element has none, as a browser answers it.
beforeEach(() => {
  Element.prototype.getAnimations = () => [];
});

/** A box that scrolls `left` px of a row wider than itself, as jsdom lays nothing out. */
const scrolling = (node: HTMLElement, left: number): void => {
  Object.defineProperties(node, {
    scrollWidth: { value: 1755, configurable: true },
    clientWidth: { value: 350, configurable: true },
    scrollLeft: { value: left, configurable: true }
  });
  node.style.overflowX = 'auto';
};

// A carousel named by its track — whose own box never scrolls — read "moved nothing", and its scroller
// could only be named by an inner class.
describe('page play, in the page', () => {
  it('reads how far a part moved by the one row it holds that scrolls, when its own box does not', () => {
    // A DOMRect's fields alone, as play reads them: jsdom has no constructor that lays a box out.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 20,
      top: 256,
      width: 350,
      height: 350
    } as DOMRect);
    document.body.innerHTML = '<div id="track"><div class="scroller"><div>1</div><div>2</div></div></div>';
    const track = document.getElementById('track');
    const scroller = track?.querySelector<HTMLElement>('.scroller');
    if (!track || !scroller) {
      throw new Error('no track');
    }

    scrolling(scroller, 702);
    expect(stateOf(track).offset.x).toBe(702 - 20);
    expect(stateOf(scroller).offset.x).toBe(702 - 20);
  });

  // A spike read a stack's sr-only "1 listening" as a second count on screen; a list read whole held its rows' hidden
  // "Added by ↓", and how many rows it showed had to be inferred from the keys moving.
  it('reads a part for screen readers alone as such, and a list by the words and rows a visitor sees', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const pixel = this.classList.contains('sr-only');

      return { left: 0, top: 0, width: pixel ? 1 : 300, height: pixel ? 1 : 40 } as DOMRect;
    });
    document.body.innerHTML = `
      <div id="stack"><span>3</span><span class="sr-only" style="overflow: hidden; clip-path: inset(50%)">1 listening</span></div>
      <ul id="tracks">
        <li data-plitzi-el="track-row"><span>Juno</span><span hidden>Added by ↓</span></li>
        <li data-plitzi-el="track-row"><span>Nova</span><span style="display: none">Added by ↓</span></li>
        <li data-plitzi-el="track-row" hidden><span>Vega</span></li>
      </ul>`;
    const [stack, listening, tracks] = ['#stack', '.sr-only', '#tracks'].map(selector => {
      const found = document.querySelector(selector);
      if (!found) {
        throw new Error(`no ${selector}`);
      }

      return found;
    });

    expect(stateOf(listening)).toMatchObject({ shown: false, screenReaderOnly: true });
    expect(stateOf(stack)).toMatchObject({ shown: true, text: '3' });
    expect(stateOf(stack).screenReaderOnly).toBeUndefined();
    expect(stateOf(tracks)).toMatchObject({ text: 'Juno Nova', rows: 2 });
  });
});

// A row's click flew a globe, and play read the canvas "as before": nothing let a check read a plugin's own view.
describe('an element’s own state, in the page', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__plitzi');
    document.body.innerHTML = '';
  });

  it('is read as the dev tools keep it — a plugin’s camera — and left out when it keeps none', () => {
    document.body.innerHTML = '<div data-plitzi-el="globe"><canvas></canvas></div>';
    const globe = document.querySelector('[data-plitzi-el="globe"]');
    if (!globe) {
      throw new Error('no globe');
    }

    const states: Record<string, unknown> = { globe: { camera: { lng: 81.8, lat: 16.4 } } };
    Reflect.set(window, '__plitzi', { element: (id: string) => ({ id, state: states[id] }) });
    expect(stateOf(globe).own).toBe('{"camera":{"lng":81.8,"lat":16.4}}');

    states.globe = {};
    expect(stateOf(globe).own).toBeUndefined();
  });
});
