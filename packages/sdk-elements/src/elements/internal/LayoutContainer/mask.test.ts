import { describe, expect, it } from 'vitest';

import { boxOf, maskFrameOf } from './mask';

const boxed = (element: HTMLElement, left: number, top: number, width: number, height: number): HTMLElement => {
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);

  return element;
};

describe('the layout mask', () => {
  it('measures a slot that draws no box by what it holds', () => {
    const slot = document.createElement('div');
    slot.style.display = 'contents';
    document.body.append(slot);
    slot.append(
      boxed(document.createElement('div'), 100, 80, 400, 50),
      boxed(document.createElement('div'), 100, 130, 600, 300)
    );

    const box = boxOf(slot);

    expect([box?.left, box?.top, box?.width, box?.height]).toEqual([100, 80, 600, 350]);
    expect(boxOf(boxed(document.createElement('div'), 1, 2, 3, 4))?.width).toBe(3);
  });

  it('draws in the layout, or — the layout drawing no box — in the ancestor that positions it', () => {
    const page = document.createElement('div');
    page.style.position = 'relative';
    const layout = document.createElement('div');
    page.append(layout);
    document.body.append(page);

    expect(maskFrameOf(layout)).toBe(layout);

    layout.style.display = 'contents';

    expect(maskFrameOf(layout)).toBe(page);
  });
});
