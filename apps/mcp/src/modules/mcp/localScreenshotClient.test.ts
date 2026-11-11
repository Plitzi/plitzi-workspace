import { describe, expect, it } from 'vitest';

import { captureParts, createLocalScreenshotClient, resolveLocalBrowser } from './localScreenshotClient';

/**
 * What matters here is the WIRING, not the picture: whether a host that has a browser gets a client shaped exactly
 * like the HTTP one, and whether a host without one is told so instead of being handed a client that throws on
 * first use. Driving a real browser belongs to the visual suites, which have a server to point it at.
 */

describe('mcp/localScreenshotClient', () => {
  it('produces a client interchangeable with the HTTP one when a driver is installed', async () => {
    const driver = await resolveLocalBrowser();
    const client = await createLocalScreenshotClient({ renderBaseUrl: 'https://ssr.example.test' });

    // Both answers are correct — it depends on the host — and each one has to hold its half of the contract.
    if (driver) {
      expect(typeof client?.capture).toBe('function');
    } else {
      expect(client).toBeUndefined();
    }
  });
});

// Chromium paints nothing past 16,384 px of one capture: the foot of a long page was white.
describe('the regions a page is captured in', () => {
  it('is one for a page one capture holds', () => {
    expect(captureParts('desktop', 1440, 16_000)).toEqual([{ label: 'desktop' }]);
  });

  it('is parts of 8,000 px, in order and each saying its place, for a taller one', () => {
    expect(captureParts('desktop', 1440, 20_500)).toEqual([
      { label: 'desktop (1/3)', clip: { x: 0, y: 0, width: 1440, height: 8000 } },
      { label: 'desktop (2/3)', clip: { x: 0, y: 8000, width: 1440, height: 8000 } },
      { label: 'desktop (3/3)', clip: { x: 0, y: 16_000, width: 1440, height: 4500 } }
    ]);
  });
});
