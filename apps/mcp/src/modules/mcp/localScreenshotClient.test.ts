import { describe, expect, it } from 'vitest';

import { createLocalScreenshotClient, resolveLocalBrowser } from './localScreenshotClient';

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
