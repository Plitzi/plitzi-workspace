// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createCanvasPage } from './canvasPage';

vi.mock('./reveal', () => ({ reveal: () => undefined }));

/**
 * The builder's canvas with an element that draws a canvas of its own — a map — at 100,50, 400×200: jsdom lays
 * nothing out and finds nothing at a point, so its box and what is at a point are said here.
 */
const mapCanvas = () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const inner = iframe.contentDocument;
  if (!inner) {
    throw new Error('jsdom gave the iframe no document');
  }

  inner.body.innerHTML = '<div data-plitzi-el="map"><canvas></canvas></div>';
  const map = inner.querySelector('[data-plitzi-el="map"]');
  const drawn = inner.querySelector('canvas');
  if (!map || !drawn) {
    throw new Error('no map in the canvas');
  }

  for (const node of [map, drawn]) {
    node.getBoundingClientRect = () => new DOMRect(100, 50, 400, 200);
    Object.assign(node, { checkVisibility: () => true });
  }

  inner.elementFromPoint = () => drawn;
  const pressed: { on: string; x: number; y: number }[] = [];
  for (const node of [map, drawn]) {
    node.addEventListener('click', event => {
      // The iframe's own events are of its realm: read by their fields, not by this window's classes.
      if (event.target === node) {
        const x: unknown = Reflect.get(event, 'clientX');
        const y: unknown = Reflect.get(event, 'clientY');
        pressed.push({ on: node.localName, x: typeof x === 'number' ? x : -1, y: typeof y === 'number' ? y : -1 });
      }
    });
  }

  const page = createCanvasPage({
    iframe,
    navigate: () => undefined,
    back: () => undefined,
    resize: () => undefined,
    scheme: () => undefined
  });

  return { page, pressed };
};

// A journey's press on a quake of a map's canvas landed on the map's centre in the builder, and on the quake elsewhere.
describe('a press on an element that renders a canvas, in the builder’s canvas', () => {
  it('reaches what is drawn at a point of it — and the element itself at its centre, as before', async () => {
    const { page, pressed } = mapCanvas();
    await page
      .locator('[data-plitzi-el="map"]')
      .first()
      .click({ timeout: 200, position: { x: 120, y: 120 } });
    await page.locator('[data-plitzi-el="map"]').first().click({ timeout: 200 });

    expect(pressed).toEqual([
      { on: 'canvas', x: 220, y: 170 },
      { on: 'div', x: 0, y: 0 }
    ]);
  });

  // A journey's wait or expectation reads its element as its press finds it: through the element, not a page query.
  it('runs what a step reads on the element itself', async () => {
    const { page } = mapCanvas();

    expect(
      await page
        .locator('[data-plitzi-el="map"]')
        .first()
        .evaluate((node, tag: string) => node.querySelector(tag)?.localName, 'canvas')
    ).toBe('canvas');
  });
});
