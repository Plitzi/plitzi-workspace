import type { McpLogEvent, McpLogger } from '@plitzi/sdk-shared';

// Request logging for the MCP server. The service is otherwise silent, which makes debugging a live agent session
// hard (you cannot see what it called or why a call failed). Two ways to turn it on:
//   - the CONSUMER passes a `mcpLogger` (SSRServerConfig.mcpLogger) — it receives a structured McpLogEvent per tool
//     call / resource read and renders it however it likes (dev tooling, dashboards, structured logs); or
//   - standalone, set `MCP_DEBUG=1` and events print to the console (the ALIAS_LOADER_DEBUG=1 convention).
// With neither active the sink is a no-op, so production stays silent and cheap.
const MCP_DEBUG = process.env.MCP_DEBUG === '1';

// A one-line, truncated JSON summary of a call's args — enough to identify it without dumping a whole batch.
const summarize = (value: unknown, max = 300): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }

  return json.length > max ? `${json.slice(0, max)}…` : json;
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const consoleRender = (event: McpLogEvent): void => {
  const kind = event.kind === 'tool' ? 'tools/call' : 'resources/read';
  const detail = event.argsSummary ? ` ${event.argsSummary}` : '';
  const status = event.ok ? 'ok' : `ERROR ${event.error ?? ''}`;
  console.log(`[mcp] ${kind} ${event.name}${detail} ${Math.round(event.durationMs)}ms ${status}`);
};

export interface McpLog {
  toolCall(name: string, args: unknown, ms: number, error?: unknown): void;
  resourceRead(uri: string, ms: number, error?: unknown): void;
}

const noop = (): void => undefined;
const inertLog: McpLog = { toolCall: noop, resourceRead: noop };

/** Build the request-log sink for one MCP server. Dispatches structured events to the consumer's `logger` when
 *  provided; otherwise renders to the console when MCP_DEBUG=1; otherwise a no-op. */
export const createMcpLog = (logger?: McpLogger): McpLog => {
  if (!logger && !MCP_DEBUG) {
    return inertLog;
  }

  const emit = (event: McpLogEvent): void => {
    if (logger) {
      logger(event);
    } else {
      consoleRender(event);
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
