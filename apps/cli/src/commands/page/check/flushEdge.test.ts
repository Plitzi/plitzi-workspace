// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushEdgesInPage } from './expect';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Boxes by element name, as a browser lays them out: jsdom lays nothing out. */
const laidOut = (boxes: Record<string, [number, number]>) =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const [top, bottom] = boxes[this.getAttribute('data-plitzi-el') ?? ''] ?? [0, 0];

    return new DOMRect(0, top, 200, bottom - top);
  });

// Carlos: a run's "Ver cartelera completa" on #combates' bottom edge, and nothing had said it.
describe('a link on its section’s edge', () => {
  it('is said of a section that keeps no space below — once, of the innermost — and not of one that does', () => {
    document.body.innerHTML = `
      <section data-plitzi-el="home-fights" style="padding-bottom: 0px"><a data-plitzi-el="home-fights-all">Ver</a></section>
      <section data-plitzi-el="home-media" style="padding-bottom: 0px">
        <section data-plitzi-el="home-podcast" style="padding-bottom: 0px"><a data-plitzi-el="home-podcast-latest">Oír</a></section>
      </section>
      <section data-plitzi-el="home-faq" style="padding-bottom: 112px"><a data-plitzi-el="home-faq-more">Más</a></section>`;
    laidOut({
      'home-fights': [0, 400],
      'home-fights-all': [360, 400],
      'home-media': [400, 900],
      'home-podcast': [400, 900],
      'home-podcast-latest': [860, 900],
      'home-faq': [900, 1300],
      'home-faq-more': [1150, 1188]
    });

    expect(flushEdgesInPage()).toEqual([
      { id: 'home-fights-all', section: 'home-fights' },
      { id: 'home-podcast-latest', section: 'home-podcast' }
    ]);
  });
});
