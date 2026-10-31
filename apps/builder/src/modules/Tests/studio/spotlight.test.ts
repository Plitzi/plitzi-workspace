import { afterEach, describe, expect, it } from 'vitest';

import { clearSpotlight, spotlight } from './spotlight';

const RING = '[data-plitzi-test-spotlight]';

/** An element of the canvas at a box of its own: jsdom lays nothing out. */
const placed = (id: string, box: { top: number; left: number }): HTMLElement => {
  const node = document.createElement('button');
  node.dataset.plitziEl = id;
  node.getBoundingClientRect = () => new DOMRect(box.left, box.top, 120, 40);
  node.checkVisibility = () => true;
  node.scrollIntoView = () => undefined;
  document.body.append(node);

  return node;
};

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

afterEach(() => {
  clearSpotlight(document);
  document.body.replaceChildren();
});

describe('the spotlight of a step played', () => {
  it('rings the element, and follows it when the page moves it without a scroll', async () => {
    const box = { top: 100, left: 50 };
    placed('add-croissant', box);

    spotlight(document, 'add-croissant', 'act');

    expect(document.querySelector<HTMLElement>(RING)?.style.top).toBe('96px');

    box.top = 300;
    document.body.append(document.createElement('div'));
    await nextFrame();

    expect(document.querySelector<HTMLElement>(RING)?.style.top).toBe('296px');
  });

  it('goes with its element when the play moves to another page', async () => {
    const node = placed('add-croissant', { top: 100, left: 50 });
    spotlight(document, 'add-croissant', 'act');

    expect(document.querySelector(RING)).not.toBeNull();

    node.remove();
    await nextFrame();

    expect(document.querySelector(RING)).toBeNull();
  });
});
