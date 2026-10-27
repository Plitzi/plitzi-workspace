// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { textsInPage } from './expect';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * jsdom lays nothing out and reads no `innerText`: every element has a box 160 px wide and reads its text, and its
 * words are as long as `widths` says they are laid out.
 */
const laidOut = (widths: Record<string, number>): void => {
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
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 160, 20));
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Range) {
      return new DOMRect(0, 0, widths[this.toString()] ?? 0, 20);
    }
  });
};

// encore-13's "ROOFTOP SESSIO…": every word in the page, a box cutting what a visitor read.
describe('what each element drawn shows', () => {
  it('says the copies whose text a box cuts — itself, or one inside it when asked', () => {
    document.body.innerHTML = [
      '<div data-plitzi-el="plate"><span data-plitzi-el="plate-room" style="text-overflow: ellipsis; overflow: hidden">Rooftop Sessions</span></div>',
      '<div data-plitzi-el="plate"><span data-plitzi-el="plate-room" style="text-overflow: ellipsis; overflow: hidden">Night</span></div>'
    ].join('');
    // The first plate's room runs past its box.
    laidOut({ 'Rooftop Sessions': 175, Night: 40 });

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

  // encore-14: a title whose overflow-x: clip cuts its ::after hairline read "cut short", its 90 px of words whole.
  it('reads no cut where only a pseudo-element runs past the box, its words whole', () => {
    document.body.innerHTML = '<h2 data-plitzi-el="room-coming-title" style="overflow-x: clip">Later this week</h2>';
    laidOut({ 'Later this week': 90 });
    Object.defineProperty(document.querySelector('h2'), 'scrollWidth', { value: 800 });

    expect(textsInPage({ selector: '[data-plitzi-el="room-coming-title"]', within: false }).drawn).toEqual([
      { id: 'room-coming-title', text: 'Later this week', cut: false }
    ]);
  });
});
