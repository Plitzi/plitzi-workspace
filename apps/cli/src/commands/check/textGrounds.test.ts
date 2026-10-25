// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { textGrounds } from './themes';

/** jsdom lays nothing out: a box is what its `data-box` says, `w×h`, or 200×20. */
const laidOut = () =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const [width, height] = (this.getAttribute('data-box') ?? '200x20').split('x').map(Number);

    return { left: 0, top: 0, right: width, bottom: height, width, height } as DOMRect;
  });

afterEach(() => {
  vi.restoreAllMocks();
});

// encore-3: the ON AIR lamp's hidden line failed contrast at 1.06:1 — a reader never sees it.
describe('the words page check judges for contrast', () => {
  it('leaves out words clipped to nothing for screen readers alone, and keeps the words shown', () => {
    laidOut();
    document.body.innerHTML = `
      <div data-plitzi-el="lamp-hidden-box" data-box="1x1" style="position: absolute; overflow: hidden">
        <span data-plitzi-el="lamp-said">On air</span>
      </div>
      <span data-plitzi-el="lamp-inset" style="clip-path: inset(50%)">On air</span>
      <span data-plitzi-el="lamp-rect" style="position: absolute; clip: rect(0, 0, 0, 0)">On air</span>
      <div data-plitzi-el="panel" data-box="300x100" style="overflow: auto">
        <span data-plitzi-el="panel-words">Shown</span>
      </div>`;

    expect(textGrounds().map(ground => ground.text)).toEqual(['panel-words']);
  });
});
