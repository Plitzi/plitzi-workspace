import { describe, expect, it, vi } from 'vitest';

import { createHttpScreenshotClient } from './screenshotClient';

import type { ScreenshotInput } from './types';

const respond = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clientAnswering = (response: Response) => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
  const client = createHttpScreenshotClient({
    serviceUrl: 'http://browser.test/screenshot',
    renderBaseUrl: 'http://ssr.test',
    fetchImpl
  });

  return { client, fetchImpl };
};

const input: ScreenshotInput = {
  pagePath: '/',
  token: 't',
  viewports: [{ label: 'desktop', width: 1440, height: 900 }]
};

describe('mcp/screenshotClient', () => {
  it('asks the browser service for the colour scheme it was given', async () => {
    const { client, fetchImpl } = clientAnswering(
      respond(200, { images: [{ label: 'desktop', mimeType: 'image/png', data: 'AA==' }] })
    );

    await client.capture({ ...input, colorScheme: 'dark' });

    const body = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(typeof body === 'string' ? body : '')).toMatchObject({ colorScheme: 'dark' });
  });

  /** An error page paints like any other, so the caller has to be told the render failed — and must not keep it. */
  it('reports a page the service refused as a failed render, not as a failed service', async () => {
    const { client } = clientAnswering(respond(502, { error: 'RENDER_FAILED', status: 404 }));

    expect(await client.capture(input)).toEqual({
      ok: false,
      error: 'RENDER_FAILED',
      message: 'The page answered 404.'
    });
  });

  it('reports any other non-OK answer as the service failing', async () => {
    const { client } = clientAnswering(respond(500, { error: 'boom' }));

    expect(await client.capture(input)).toMatchObject({ ok: false, error: 'SCREENSHOT_FAILED' });
  });
});
