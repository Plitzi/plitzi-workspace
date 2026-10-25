// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stateOf } from './play';

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

// lx-product: a carousel named by its track — whose own box never scrolls — read "moved nothing", and its scroller
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
});
