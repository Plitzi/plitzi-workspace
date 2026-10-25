// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { foundIn, markShown, outlineIn } from './outline';

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

  // lx-product: after `--click` the whole page was outlined, the open menu cut by --depth under it.
  it('lists only what a click opened, from its own depth, walking through what showed before', () => {
    laidOut();
    document.body.innerHTML = `
      <header><button id="menu-btn">Menu</button><div id="mega" hidden><nav><a>Audífonos</a></nav></div></header>
      <main><section><h2>Hero</h2></section></main>`;
    markShown('data-before');
    document.getElementById('mega')?.removeAttribute('hidden');
    const read = outlineIn({ opened: 'data-before', depth: 4, limit: 50, words: 20 });

    expect(read).toEqual({
      elements: [
        expect.objectContaining({ selector: '#mega', depth: 0 }),
        expect.objectContaining({ selector: 'nav', depth: 1 }),
        expect.objectContaining({ selector: 'a', depth: 2, text: 'Audífonos' })
      ],
      more: 0
    });
  });

  // encore-3: a page's first levels were five bare divs and "480 more under these", none of its parts named; and a part
  // asked by --within was its hidden copy, outlined empty.
  it('walks through bare wrappers to the parts, and outlines the copy of a part a visitor sees', () => {
    laidOut();
    document.body.innerHTML = `
      <div><div><div><section data-plitzi-el="home-hero"><h1>Encore</h1></section></div></div></div>
      <ul data-plitzi-el="requests" hidden><li>hidden copy</li></ul>
      <ul data-plitzi-el="requests"><li>Sam's request</li></ul>`;

    expect(outlineIn({ depth: 0, limit: 50, words: 20 })).toMatchObject({
      elements: [
        expect.objectContaining({ element: 'home-hero', depth: 0 }),
        expect.objectContaining({ element: 'requests' })
      ]
    });
    expect(outlineIn({ within: '[data-plitzi-el="requests"]', depth: 2, limit: 50, words: 20 })).toMatchObject({
      elements: [expect.objectContaining({ text: "Sam's request" })]
    });
  });
});

// encore-4: the sign-in wordmark's id came from a prefix built in code — found by grepping the source.
describe('page outline --find', () => {
  it('lists the elements whose name, selector or words hold the word, each at the top', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(
      foundIn(
        [
          { selector: 'header', depth: 0, box },
          { selector: '[data-plitzi-el="auth-brand-wordmark"]', depth: 3, box, element: 'auth-brand-wordmark' },
          { selector: 'p', depth: 4, box, text: 'Sign in to Encore' }
        ],
        'WORDMARK'
      )
    ).toEqual([{ selector: '[data-plitzi-el="auth-brand-wordmark"]', depth: 0, box, element: 'auth-brand-wordmark' }]);
  });
});
