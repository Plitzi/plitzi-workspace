// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { canvasWaits } from './canvasWaits';

afterEach(() => {
  vi.useRealTimers();
});

describe('the waits for the canvas drawn anew', () => {
  it('are all answered by the next canvas mounted', async () => {
    const waits = canvasWaits(1000);
    const chosen = waits.wait();
    const played = waits.wait();
    const iframe = document.createElement('iframe');
    waits.mounted(iframe);

    expect(await Promise.all([chosen, played])).toEqual([iframe, iframe]);
  });

  // A flow chosen, another chosen at once, and played: the first's wait giving up left the play's with no page.
  it('give up one at a time, never taking another with them', async () => {
    vi.useFakeTimers();
    const waits = canvasWaits(1000);
    const superseded = waits.wait();
    vi.advanceTimersByTime(600);
    const played = waits.wait();
    vi.advanceTimersByTime(500);

    await expect(superseded).rejects.toThrow('did not show again in time');
    const iframe = document.createElement('iframe');
    waits.mounted(iframe);

    expect(await played).toBe(iframe);
  });
});
