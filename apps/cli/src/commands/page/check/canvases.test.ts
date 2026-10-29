import { describe, expect, it } from 'vitest';

import { canvasesInPage, oneColourCanvases, oneColourIn } from './canvases';
import { reportText } from './text';

import type { CheckReport } from './types';
import type { BrowserPage } from '../../../browser';

// A run's look said "nothing wrong" of a globe painted solid orange, edge to edge.
describe('a canvas painted one colour', () => {
  it('is read off a picture of each canvas, and said beside the verdict, failing nothing', async () => {
    const colours = ['#c25a12', undefined];
    const page = {
      evaluate: (fn: unknown) =>
        Promise.resolve(
          fn === canvasesInPage
            ? [
                { id: 'atlas', x: 0, y: 0, width: 800, height: 800 },
                { id: 'sparkline', x: 0, y: 900, width: 300, height: 120 }
              ]
            : fn === oneColourIn
              ? colours.shift()
              : undefined
        ),
      screenshot: () => Promise.resolve(new Uint8Array(24))
    };

    // The fake answers what reading canvases calls of a page, and nothing else a page has.
    const painted = await oneColourCanvases(page as unknown as BrowserPage);
    expect(painted).toEqual([{ id: 'atlas', colour: '#c25a12' }]);

    const report: CheckReport = {
      path: '/',
      width: 1440,
      ok: true,
      checked: 10,
      problems: [],
      issues: [],
      hiddenAtWidth: [],
      outOfUse: [],
      empty: [],
      consoleErrors: [],
      failedRequests: [],
      devTools: true,
      lists: {},
      oneColour: painted
    };
    const text = reportText(report, { state: false, elements: [] });
    expect(text).toContain('nothing wrong');
    expect(text).toContain('canvas atlas: painted one colour, #c25a12, edge to edge');
  });
});
