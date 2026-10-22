// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { drawing, firstDifference } from './same';

// velada-fidelity: a look pictured nine pages a shared file reached, for two tokens added — what draws the same is not.
describe('page same', () => {
  it('says the first element two drawings differ by, or none', () => {
    expect(firstDifference(['div | a', 'p | b'], ['div | a', 'p | b'])).toBeUndefined();
    expect(firstDifference(['div | a', 'p | b'], ['div | a', 'p | c'])).toEqual({ here: 'p | b', there: 'p | c' });
    expect(firstDifference(['div | a'], ['div | a', 'p | b'])).toEqual({ here: '(nothing)', there: 'p | b' });
  });

  it('reads each element’s name and words, and what its ::before draws', () => {
    document.body.innerHTML = '<section data-plitzi-el="fights"><span data-plitzi-el="vs">VS</span></section>';
    // jsdom lays nothing out: every element is given a box, as a browser would.
    Element.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList;
    const lines = drawing();

    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^span \| vs \| VS \|/);
  });

  // A task's parts are compared alone; what is read is that nothing else moved.
  it('leaves a task’s parts out, and still finds what changed outside them', () => {
    Element.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList;
    const page = (faq: string, footer: string) =>
      `<main><section data-plitzi-el="home-faq"><h2 data-plitzi-el="home-faq-title">${faq}</h2></section><footer data-plitzi-el="site-footer" style="color: ${footer}">©</footer></main>`;

    document.body.innerHTML = page('Preguntas frecuentes', 'rgb(1, 2, 3)');
    const before = drawing(['home-faq']);
    document.body.innerHTML = page('Preguntas y respuestas', 'rgb(1, 2, 3)');
    expect(firstDifference(drawing(['home-faq']), before)).toBeUndefined();

    document.body.innerHTML = page('Preguntas y respuestas', 'rgb(9, 9, 9)');
    expect(firstDifference(drawing(['home-faq']), before)?.here).toMatch(/^footer \| site-footer \| © \|/);
  });
});
