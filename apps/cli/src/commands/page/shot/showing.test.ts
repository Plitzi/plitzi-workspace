// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mostShowingInPage } from './capture';

afterEach(() => {
  vi.restoreAllMocks();
});

// A run's look pictured a playing room card for a task that changed the idle one: the first instance of the part.
describe('a part drawn more than once, clipped', () => {
  it('is the copy that shows the most of what was asked for — the first when none shows more', () => {
    // jsdom draws nothing: what is hidden has no box, the rest one.
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      const boxes = this.closest('[hidden]') ? [] : [new DOMRect(0, 0, 10, 10)];

      // A DOMRectList has no constructor jsdom exposes: an array with its `item` stands for one.
      return Object.assign(boxes, { item: (index: number) => boxes[index] ?? null });
    });
    document.body.innerHTML = [
      '<div data-plitzi-el="room-card-root"><p data-plitzi-el="room-card-now">Phoenix</p><p data-plitzi-el="room-card-idle" hidden>Off air</p></div>',
      '<div data-plitzi-el="room-card-root"><p data-plitzi-el="room-card-now" hidden>—</p><p data-plitzi-el="room-card-idle">Off air</p></div>'
    ].join('');

    expect(mostShowingInPage({ selector: '[data-plitzi-el="room-card-root"]', ids: ['room-card-idle'] })).toBe(1);
    expect(mostShowingInPage({ selector: '[data-plitzi-el="room-card-root"]', ids: ['room-card-now'] })).toBe(0);
    expect(mostShowingInPage({ selector: '[data-plitzi-el="room-card-root"]', ids: ['nothing'] })).toBe(0);
  });
});
