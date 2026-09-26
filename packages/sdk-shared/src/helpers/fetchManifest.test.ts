import { afterEach, describe, expect, it, vi } from 'vitest';

import fetchManifest from './fetchManifest';

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchManifest', () => {
  /** A header outside the CORS-safelisted few makes the browser ask the plugin's host first, and a bucket says no. */
  it('asks for JSON without a header that turns the request into a preflighted one', async () => {
    const fetch = respond(200, { root: 'seatPicker' });

    expect(await fetchManifest('https://cdn.example.com/seat-picker/plugin-manifest.json')).toEqual({
      root: 'seatPicker'
    });

    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('answers nothing for a manifest the host does not have, or cannot be reached for', async () => {
    respond(404, { message: 'Not Found' });
    expect(await fetchManifest('https://cdn.example.com/gone/plugin-manifest.json')).toBeUndefined();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchManifest('https://offline.example.com/plugin-manifest.json')).toBeUndefined();
  });
});
