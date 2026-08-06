import { renderLogEvent } from '@plitzi/sdk-server/kernel';

import type { ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

// The protocol half of the server's log: what the agent CALLED, which the HTTP request event cannot show (every
// call shares one POST, and a failing tool still answers 200). Two ways to turn it on:
//   - the CONSUMER passes a `logger` (SSRServerConfig.logger) — the same sink that receives the request events, so
//     tool calls, resource reads and requests come out as one stream; or
//   - standalone, set `MCP_DEBUG=1` and these events print to the console (the ALIAS_LOADER_DEBUG=1 convention).
// With neither active the sink is a no-op, so production stays silent and cheap.
const MCP_DEBUG = process.env.MCP_DEBUG === '1';

// Tool arguments carry whatever the agent is writing into the space — copy, form labels, contact details — so the
// log describes their SHAPE, never their content: keys, array lengths and value types. That identifies the call
// ('plitzi_apply {operations:[3]}') without putting user data in a log file.
const MCP_LOG_ARGS = process.env.MCP_LOG_ARGS === '1';

const shapeOf = (value: unknown, depth = 0): string => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.length}]`;
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return '{…}';
    }

    const entries = Object.entries(value);
    const shown = entries.slice(0, 8).map(([key, item]) => `${key}:${shapeOf(item, depth + 1)}`);

    return `{${[...shown, ...(entries.length > shown.length ? ['…'] : [])].join(',')}}`;
  }

  return typeof value;
};

// The escape hatch for local debugging (MCP_LOG_ARGS=1): the real arguments, truncated. Never on by default.
const rawSummary = (value: unknown, max = 300): string => {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }

  return json.length > max ? `${json.slice(0, max)}…` : json;
};

const summarize = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return MCP_LOG_ARGS ? rawSummary(value) : shapeOf(value);
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export interface McpLog {
  toolCall(name: string, args: unknown, ms: number, error?: unknown): void;
  resourceRead(uri: string, ms: number, error?: unknown): void;
}

const noop = (): void => undefined;
const inertLog: McpLog = { toolCall: noop, resourceRead: noop };

/** Build the protocol-log sink for one MCP server. Dispatches structured events to the consumer's `logger` when
 *  provided; otherwise renders to the console when MCP_DEBUG=1; otherwise a no-op. */
export const createMcpLog = (logger?: ServerLogger): McpLog => {
  if (!logger && !MCP_DEBUG) {
    return inertLog;
  }

  const emit = (event: ServerLogEvent): void => {
    if (logger) {
      logger(event);
    } else {
      console.log(renderLogEvent(event));
    }
  };

  return {
    toolCall: (name, args, ms, error) =>
      emit({
        kind: 'tool',
        name,
        durationMs: ms,
        ok: !error,
        ...(error ? { error: errorText(error) } : {}),
        ...(summarize(args) !== undefined ? { argsSummary: summarize(args) } : {}),
        timestamp: new Date().toISOString()
      }),
    resourceRead: (uri, ms, error) =>
      emit({
        kind: 'resource',
        name: uri,
        durationMs: ms,
        ok: !error,
        ...(error ? { error: errorText(error) } : {}),
        timestamp: new Date().toISOString()
      })
  };
};
