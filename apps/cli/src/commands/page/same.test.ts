// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { differenceText, drawing, firstDifference } from './same';

// A look pictured nine pages a shared file reached, for two tokens added — what draws the same is not.
describe('page same', () => {
  // A run's look said an element moved with two lines of twenty fields joined by bars, the one that differed to find.
  it('says the first element two drawings differ by, field by field — or one drawn on one side alone, or none', () => {
    const div = { tag: 'div', name: 'home', box: '0,0,100x40' };
    const list = (height: number) => ({
      tag: 'li',
      name: 'container-57',
      box: `0,0,249x${String(height)}`,
      color: 'red'
    });
    expect(firstDifference([div, list(314)], [div, list(314)])).toBeUndefined();

    const moved = firstDifference([div, list(331)], [div, list(314)]);
    expect(moved).toEqual({
      element: 'container-57',
      changed: [{ field: 'box', here: '0,0,249x331', there: '0,0,249x314' }]
    });
    expect(moved && differenceText(moved)).toBe('container-57: box 0,0,249x314 → 0,0,249x331');

    const gone = firstDifference([div], [div, list(314)]);
    expect(gone).toEqual({ element: 'container-57', changed: [], only: 'there' });
    expect(gone && differenceText(gone)).toBe('container-57 was drawn before, and is not here');
  });

  // The CLI's sanity run: a show's start a minute apart on the two servers read as the page "moved".
  it('says when the element differs by its words alone, drawn the same', () => {
    const at = (time: string, box = '0,0,157x20') => ({ tag: 'time', name: '', words: `Today ${time} UTC`, box });
    expect(firstDifference([at('02:52')], [at('02:53')])).toEqual({
      element: 'time',
      changed: [{ field: 'words', here: 'Today 02:52 UTC', there: 'Today 02:53 UTC' }],
      wordsOnly: true
    });
    expect(firstDifference([at('02:52')], [at('02:53', '0,0,160x20')])?.wordsOnly).toBeUndefined();
  });

  // A look named only `explore-body 763→780` — what held the change, not what grew in it — and its tester could not
  // tell the two servers' data from the task.
  it('names the innermost element inside the first that differs too: what grew in it', () => {
    const el = (name: string, depth: number, box: string, words = '') => ({
      tag: 'div',
      name,
      depth: String(depth),
      box,
      words
    });
    const page = (rows: number, words: string) => [
      el('explore-body', 1, `0,0,1440x${String(763 + rows)}`),
      el('heading', 2, '0,0,1440x40', 'Rooms'),
      el('room-list', 2, `0,40,1440x${String(700 + rows)}`),
      el('room-1', 3, '0,0,1440x100'),
      el('room-2', 3, `0,100,1440x${String(100 + rows)}`),
      el('room-2-note', 4, `0,60,1440x${String(20 + rows)}`, words),
      el('room-3', 3, `0,${String(200 + rows)},1440x100`),
      el('footer', 1, '0,800,1440x40')
    ];
    const grew = firstDifference(page(17, 'Starts in 2 min — and goes on'), page(0, 'Starts in 2 min'));

    expect(grew?.element).toBe('explore-body');
    expect(grew?.inside).toEqual({
      element: 'room-2-note',
      changed: [
        { field: 'box', here: '0,60,1440x37', there: '0,60,1440x20' },
        { field: 'words', here: 'Starts in 2 min — and goes on', there: 'Starts in 2 min' }
      ]
    });
    expect(grew && differenceText(grew)).toContain('— inside it, room-2-note: box 0,60,1440x20 → 0,60,1440x37');
  });

  it('reads each element’s name and words, and what its ::before draws', () => {
    document.body.innerHTML = '<section data-plitzi-el="fights"><span data-plitzi-el="vs">VS</span></section>';
    // jsdom lays nothing out: every element is given a box, as a browser would.
    Element.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList;
    const lines = drawing();

    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ tag: 'span', name: 'vs', words: 'VS' });
  });

  // shop-shell: /overlay writes the URL it was served on — another port on each server — and "moved" on every look.
  it('reads a local address alike on both servers, whatever port each was served on', () => {
    Element.prototype.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList;
    const served = (port: number) => {
      document.body.innerHTML = `<p data-plitzi-el="overlay-url">http://127.0.0.1:${String(port)}/overlay/obs</p>`;

      return drawing();
    };

    expect(firstDifference(served(57545), served(57557))).toBeUndefined();
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
    // Its colour, and its border's, which follows it.
    expect(firstDifference(drawing(['home-faq']), before)).toMatchObject({
      element: 'site-footer',
      changed: expect.arrayContaining([{ field: 'color', here: 'rgb(9, 9, 9)', there: 'rgb(1, 2, 3)' }]) as unknown
    });
  });
});
