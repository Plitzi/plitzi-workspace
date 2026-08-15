import { describeTarget, expect, test } from '../../fixtures';

/** The MCP protocol itself is covered in depth by `apps/mcp`'s own suite. What is checked here is the thing that
 *  suite cannot see: whether the example a reader is told to start actually answers on the port its README names. */
describeTarget('mcp-server', subject => {
  test('answers the handshake an agent opens with', async ({ request }) => {
    const response = await request.post(subject.origin, {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'plitzi-e2e', version: '0.0.0' }
        }
      }
    });

    expect(response.status()).toBe(200);
    expect(await response.text(), 'the server answered without a protocol version').toContain('protocolVersion');
  });
});
