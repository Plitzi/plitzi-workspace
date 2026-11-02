// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { unrollPage } from './images';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Each element's box, as a browser lays it out — jsdom lays nothing out: [what it shows, what it holds]. */
const laidOut = (boxes: Record<string, [number, number]>) => {
  const of = (element: Element) => boxes[element.id] ?? [0, 0];
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return of(this)[0];
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return of(this)[1];
  });
};

// A full-screen page with a list scrolling in a panel: the list was unrolled, its rows drawn over the band below.
describe('a whole-page picture', () => {
  it('unrolls the page’s own column, and leaves a list scrolling inside a panel as it is shown', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    document.body.innerHTML = '<div id="column"><div id="panel"><ul id="feed"></ul></div></div>';

    laidOut({ column: [900, 900], panel: [504, 504], feed: [504, 5338] });
    unrollPage();
    expect(document.getElementById('feed')?.style.overflow).toBe('');

    laidOut({ column: [900, 3200], panel: [3200, 3200], feed: [3200, 3200] });
    unrollPage();
    expect(document.getElementById('column')?.style.overflow).toBe('visible');
  });
});
