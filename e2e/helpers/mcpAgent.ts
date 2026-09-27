import { expect } from '@playwright/test';

/** A tool's answer, as MCP sends it: words, and whether they say it failed. */
export type ToolResult = { content?: { type: string; text?: string }[]; isError?: boolean };

/**
 * An MCP client in a few lines of JSON-RPC over HTTP — what an agent's app sends to Pizarra's `/mcp` — that notes which
 * replica answered each call.
 */
export const agentAt = async (origin: string) => {
  let session = '';
  let id = 0;
  const replicas = new Set<string>();
  const rpc = async (method: string, params: object, notification = false): Promise<unknown> => {
    const response = await fetch(new URL('/mcp', origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {})
      },
      body: JSON.stringify(
        notification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params }
      )
    });
    session = response.headers.get('mcp-session-id') ?? session;
    replicas.add(response.headers.get('x-pizarra-replica') ?? '');
    if (notification) {
      return undefined;
    }

    expect(response.status, `${method} answered ${response.status}`).toBe(200);
    // An event stream, as the endpoint answers: the answer is the `data:` of its message.
    const stream = await response.text();
    const data = stream
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice('data: '.length)) as { id?: number; result?: unknown })
      .find(message => message.id === id);

    return data?.result;
  };

  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'claude-code', version: 'e2e' }
  });
  await rpc('notifications/initialized', {}, true);

  /** A tool called, and its answer whole — failed or not. */
  const answer = async (
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{ text: string; failed: boolean }> => {
    const result = (await rpc('tools/call', { name, arguments: args })) as ToolResult;

    return { text: (result.content ?? []).map(part => part.text ?? '').join('\n'), failed: result.isError === true };
  };

  return {
    replicas,
    answer,
    /** A tool called, and its words — failing the test when it failed. */
    call: async (name: string, args: Record<string, unknown> = {}): Promise<string> => {
      const { text, failed } = await answer(name, args);
      expect(failed, `${name}: ${text}`).toBe(false);

      return text;
    }
  };
};
