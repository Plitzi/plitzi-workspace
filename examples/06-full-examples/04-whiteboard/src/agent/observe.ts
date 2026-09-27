import { isJSONRPCErrorResponse, isJSONRPCRequest, isJSONRPCResultResponse } from '@modelcontextprotocol/sdk/types.js';

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';

/**
 * A transport that says when a tool is called and when its answer goes back — what the people on a board see as the
 * agent working, listening, and thinking in between. Watched on the wire rather than in each tool, so no tool can be
 * forgotten, whichever way the agent is reached (stdio, or the server's `/mcp`).
 */
export const observeToolCalls = (inner: Transport, called: (tool: string) => () => void): Transport => {
  const open = new Map<RequestId, () => void>();
  const outer: Transport = {
    start: () => inner.start(),
    close: () => inner.close(),
    send: async (message, options) => {
      if ((isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) && message.id !== undefined) {
        open.get(message.id)?.();
        open.delete(message.id);
      }

      await inner.send(message, options);
    },
    get sessionId() {
      return inner.sessionId;
    },
    setProtocolVersion: version => inner.setProtocolVersion?.(version)
  };

  inner.onmessage = (message, extra) => {
    if (isJSONRPCRequest(message) && message.method === 'tools/call' && typeof message.params?.name === 'string') {
      open.set(message.id, called(message.params.name));
    }

    outer.onmessage?.(message, extra);
  };
  inner.onclose = () => {
    open.forEach(done => done());
    open.clear();
    outer.onclose?.();
  };
  inner.onerror = error => outer.onerror?.(error);

  return outer;
};
