// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { probePage } from './probe';

const input = (ids: string[]) => ({
  expected: ids.map(id => ({ id, selector: `[data-plitzi-el="${id}"]` })),
  images: false,
  overflow: false,
  legibility: false
});

/** jsdom lays nothing out: every box is 0×0 unless a test says otherwise. */
const sized = (width: number, height: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    // The probe reads only the size; a whole DOMRect would be fields nothing here looks at.
    return { width: this.dataset.empty ? 0 : width, height: this.dataset.empty ? 0 : height } as DOMRect;
  });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('probePage / display:contents', () => {
  it('takes a box-less slot as showing what its children show', () => {
    sized(100, 20);
    document.body.innerHTML =
      '<div data-plitzi-el="slot" style="display: contents"><p data-plitzi-el="lede">Hello</p></div>';

    expect(probePage(input(['slot', 'lede'])).hidden).toEqual([]);
  });

  it('says so when nothing inside one shows', () => {
    sized(100, 20);
    document.body.innerHTML = '<div data-plitzi-el="slot" style="display: contents"><p data-empty="1"></p></div>';

    expect(probePage(input(['slot'])).hidden).toEqual([
      { id: 'slot', reason: 'it has no box of its own (display:contents) and nothing inside it shows' }
    ]);
  });
});
