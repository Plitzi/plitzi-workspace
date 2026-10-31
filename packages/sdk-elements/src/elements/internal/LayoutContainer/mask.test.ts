import { describe, expect, it } from 'vitest';

import { boxOf, chromeSides, maskFrameOf } from './mask';

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

  it('says which sides of its page a shell draws on — and leaves the room it only holds open', () => {
    const element = (id: string, left: number, top: number, width: number, height: number) => {
      const node = boxed(document.createElement('div'), left, top, width, height);
      node.dataset.plitziEl = id;

      return node;
    };
    const layout = document.createElement('div');
    const body = element('body', 200, 60, 800, 400);
    body.append(element('card', 220, 80, 300, 100));
    layout.append(element('header', 0, 0, 1200, 60), body);
    const page = new DOMRect(200, 60, 800, 400);

    expect(chromeSides(layout, body, page)).toEqual({ above: true, below: false, left: false, right: false });

    layout.append(element('footer', 0, 460, 1200, 80), element('sidebar', 0, 60, 200, 400));

    expect(chromeSides(layout, body, page)).toEqual({ above: true, below: true, left: true, right: false });
  });
});
