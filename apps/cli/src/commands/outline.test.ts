// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { outlineIn } from './outline';

/** jsdom lays nothing out: every element given a box, the hidden ones none. */
const laidOut = () =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const hidden = this.closest('[hidden]') !== null;

    return { left: 0, top: 0, width: hidden ? 0 : 100, height: hidden ? 0 : 20 } as DOMRect;
  });

afterEach(() => {
  vi.restoreAllMocks();
});

// lx-controls: a designer fetched the original's HTML and searched it for classes to measure against.
describe('page outline, in the page', () => {
  it('lists what a visitor sees by a selector that finds it alone, its box and first words', () => {
    laidOut();
    document.body.innerHTML = `
      <div class="facets">
        <h2 class="facets__heading">Filtrar y ordenar</h2>
        <ul><li class="item">Disponibilidad</li><li class="item">Precio</li></ul>
        <p hidden>Not shown</p>
      </div>
      <button data-plitzi-el="filters-toggle">Filtrar</button>`;
    const read = outlineIn({ within: '.facets', depth: 4, limit: 50, words: 8 });

    expect(read).toEqual({
      elements: [
        expect.objectContaining({ selector: 'h2.facets__heading', depth: 0, text: 'Filtrar …' }),
        expect.objectContaining({ selector: 'ul', depth: 0 }),
        expect.objectContaining({ selector: 'ul > li:nth-of-type(1)', depth: 1, text: 'Disponib…' }),
        expect.objectContaining({ selector: 'ul > li:nth-of-type(2)', depth: 1, text: 'Precio' })
      ],
      more: 0
    });
    for (const each of 'elements' in read ? read.elements : []) {
      expect(document.querySelectorAll(each.selector)).toHaveLength(1);
    }

    expect(outlineIn({ depth: 0, limit: 50, words: 8 })).toMatchObject({
      elements: [
        expect.objectContaining({ selector: 'div.facets' }),
        expect.objectContaining({ selector: '[data-plitzi-el="filters-toggle"]', element: 'filters-toggle' })
      ],
      more: 4
    });
    expect(outlineIn({ within: '.nothing', depth: 2, limit: 50, words: 8 })).toEqual({
      problem: 'nothing on the page answers .nothing'
    });
  });
});
