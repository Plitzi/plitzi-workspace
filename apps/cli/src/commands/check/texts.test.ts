// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { textsInPage } from './expect';

afterEach(() => {
  vi.restoreAllMocks();
});

// encore-13's "ROOFTOP SESSIO…": every word in the page, a box cutting what a visitor read.
describe('what each element drawn shows', () => {
  it('says the copies whose text a box cuts — itself, or one inside it when asked', () => {
    document.body.innerHTML = [
      '<div data-plitzi-el="plate"><span data-plitzi-el="plate-room" style="text-overflow: ellipsis; overflow: hidden">Rooftop Sessions</span></div>',
      '<div data-plitzi-el="plate"><span data-plitzi-el="plate-room" style="text-overflow: ellipsis; overflow: hidden">Night</span></div>'
    ].join('');
    // jsdom lays nothing out and reads no `innerText`: every element has a box and reads its text, and the first
    // plate's room runs 15 px past its own.
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent;
      }
    });
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(
      // A DOMRectList has no constructor jsdom exposes: an array with its `item` stands for one.
      () => Object.assign([new DOMRect(0, 0, 10, 10)], { item: () => null })
    );
    const [first] = Array.from(document.querySelectorAll('[data-plitzi-el="plate-room"]'));
    Object.defineProperty(first, 'scrollWidth', { value: 175 });
    Object.defineProperty(first, 'clientWidth', { value: 160 });

    expect(textsInPage({ selector: '[data-plitzi-el="plate-room"]', within: false }).drawn).toEqual([
      { id: 'plate-room', text: 'Rooftop Sessions', cut: true },
      { id: 'plate-room', text: 'Night', cut: false }
    ]);
    expect(textsInPage({ selector: '[data-plitzi-el="plate"]', within: false }).drawn.map(each => each.cut)).toEqual([
      false,
      false
    ]);
    expect(textsInPage({ selector: '[data-plitzi-el="plate"]', within: true }).drawn.map(each => each.cut)).toEqual([
      true,
      false
    ]);
  });
});
