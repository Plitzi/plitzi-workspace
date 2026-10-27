import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadTiming, loadTimingText } from './loadTiming';

import type { BrowserPage } from './index';

/** A page whose script runs here, with its navigation as the test says it went. */
const pageWith = (navigation: Record<string, number>): BrowserPage => {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([navigation as unknown as PerformanceEntry]);
  const fake = { evaluate: <R>(fn: () => R) => Promise.resolve(fn()) };

  // Only evaluate is reached here.
  return fake as unknown as BrowserPage;
};

afterEach(() => {
  vi.restoreAllMocks();
});

// A scout held a third-party script back to see whether a page's load waited for it, and read navigation timing by hand.
describe('a page’s load, read once its steps end', () => {
  it('says when its document was in and when it loaded', async () => {
    const timing = await loadTiming(pageWith({ domContentLoadedEventEnd: 212.4, loadEventEnd: 1384 }));

    expect(timing).toEqual({ contentLoaded: 212, load: 1384 });
    expect(loadTimingText(timing)).toBe('its document in at 212 ms, loaded at 1.4 s');
  });

  it('says a load that had not come — a request held keeps it waiting', async () => {
    const timing = await loadTiming(pageWith({ domContentLoadedEventEnd: 180, loadEventEnd: 0 }));

    expect(timing).toEqual({ contentLoaded: 180 });
    expect(loadTimingText(timing)).toBe('its document in at 180 ms, its load had not come when the steps ended');
  });
});
