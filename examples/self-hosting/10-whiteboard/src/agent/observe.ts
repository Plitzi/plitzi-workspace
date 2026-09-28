import { isJSONRPCErrorResponse, isJSONRPCRequest, isJSONRPCResultResponse } from '@modelcontextprotocol/sdk/types.js';

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';

/** What the wire is watched for, and what it may add or refuse — `tools.ts` answers each. */
export type ToolCallHooks = {
  /** A tool call began: the people see the agent working. What it answers is called as the answer goes back. */
  called: (tool: string) => () => void;
  /** Why this call is not made — somebody pressed stop — or nothing, and it is made. */
  refuse: (tool: string) => string | undefined;
  /** What the people said since the agent last heard, told with whatever answer goes back — or nothing new. */
  news: () => string | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);

/**
 * A transport that watches the tool calls on the wire: when one starts and when its answer goes back — what the people
 * on a board see as the agent working, listening, and thinking in between — and what rides on each answer.
 *
 * An agent hears the board only when it asks, and a model busy with ten calls in a row asks none of them. So whatever
 * the people said meanwhile goes back with every answer, the way a person's message reaches Claude Code between two of
 * its steps: it can answer at once, change course, or stop. And a stop pressed on the board refuses its next piece of
 * work outright, so it stops even when it would not have read the words.
 *
 * Watched on the wire rather than in each tool, so no tool can be forgotten, whichever way the agent is reached (stdio,
 * or the server's `/mcp`).
 */
export const observeToolCalls = (inner: Transport, hooks: ToolCallHooks): Transport => {
  const open = new Map<RequestId, () => void>();
  const outer: Transport = {
    start: () => inner.start(),
    close: () => inner.close(),
    send: async (message, options) => {
      if ((isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) && message.id !== undefined) {
        const done = open.get(message.id);
        open.delete(message.id);
        done?.();
        const news = done && isJSONRPCResultResponse(message) ? hooks.news() : undefined;
        const { result } = isJSONRPCResultResponse(message) ? message : { result: undefined };
        const content: unknown = isRecord(result) ? result.content : undefined;
        if (news && isRecord(result) && isList(content)) {
          const told = [...content, { type: 'text', text: news }];
          await inner.send({ ...message, result: { ...result, content: told } }, options);

          return;
        }
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
      const refusal = hooks.refuse(message.params.name);
      if (refusal !== undefined) {
        // Answered here, and never made: an error result the model reads as the reason its work stopped.
        void inner.send({
          jsonrpc: '2.0',
          id: message.id,
          result: { content: [{ type: 'text', text: refusal }], isError: true }
        });

        return;
      }

      open.set(message.id, hooks.called(message.params.name));
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
