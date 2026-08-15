import { describeTarget, expect, test } from '../../fixtures';

import type { APIRequestContext } from '@playwright/test';

/** The protocol itself is covered in depth by `apps/mcp`'s own suite. What is checked here is the seam that suite
 *  cannot see: the endpoint mounted inside a real page server, beside the pages it edits. */

const rpc = (request: APIRequestContext, origin: string, method: string, params: object = {}) =>
  request.post(`${origin}/mcp`, {
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method, params }
  });

describeTarget('server', subject => {
  test('answers the handshake an agent opens with', async ({ request }) => {
    const response = await rpc(request, subject.origin, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'plitzi-e2e', version: '0.0.0' }
    });

    expect(response.status()).toBe(200);
    expect(await response.text(), 'the server answered without a protocol version').toContain('protocolVersion');
  });

  /** The endpoint is a stage in front of the renderer, so the failure to watch for is it swallowing traffic that
   *  was never meant for it. A page request must still get a page. */
  test('does not shadow the pages it sits in front of', async ({ request }) => {
    const page = await request.get(subject.origin);

    expect(page.status()).toBe(200);

    const html = await page.text();

    expect(html).toContain('<html');
    expect(html, 'a page request was answered by the MCP endpoint').not.toContain('jsonrpc');
  });

  test('rejects a malformed call instead of falling through to the renderer', async ({ request }) => {
    const response = await request.post(`${subject.origin}/mcp`, {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      data: { not: 'json-rpc' }
    });

    expect(await response.text(), 'a broken RPC was served a page').not.toContain('<html');
  });
});
