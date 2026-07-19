import type { ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

// Finer-grained request logging for the MCP server: one event per tool call and resource read, on top of the
// consolidated `request` event the dispatcher emits for every server. Two ways to turn it on:
//   - the CONSUMER passes a `logger` (SSRServerConfig.logger) — it receives a structured ServerLogEvent
//     (service 'mcp', kind 'tool' | 'resource') and renders it however it likes; or
//   - standalone, set `MCP_DEBUG=1` and the events print to the console (the ALIAS_LOADER_DEBUG=1 convention).
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

const consoleRender = (event: ServerLogEvent): void => {
  const status = event.ok ? 'ok' : `ERROR ${event.error ?? ''}`;
  const name = event.kind === 'request' ? `${event.method} ${event.path} ${event.status}` : event.name;
  const detail = event.kind === 'tool' && event.argsSummary ? ` ${event.argsSummary}` : '';
  console.log(`[mcp] ${event.kind} ${name}${detail} ${Math.round(event.durationMs)}ms ${status}`);
};

export interface McpLog {
  toolCall(name: string, args: unknown, ms: number, error?: unknown): void;
  resourceRead(uri: string, ms: number, error?: unknown): void;
}

const noop = (): void => undefined;
const inertLog: McpLog = { toolCall: noop, resourceRead: noop };

/** Build the MCP request-log sink for one server. Dispatches structured events (service 'mcp') to the consumer's
 *  `logger` when provided; otherwise renders to the console when MCP_DEBUG=1; otherwise a no-op. */
export const createMcpLog = (logger?: ServerLogger): McpLog => {
  if (!logger && !MCP_DEBUG) {
    return inertLog;
  }

  const emit = (event: ServerLogEvent): void => {
    if (logger) {
      logger(event);
    } else {
      consoleRender(event);
    }
  };

  return {
    toolCall: (name, args, ms, error) =>
      emit({
        service: 'mcp',
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
        service: 'mcp',
        kind: 'resource',
        name: uri,
        durationMs: ms,
        ok: !error,
        ...(error ? { error: errorText(error) } : {}),
        timestamp: new Date().toISOString()
      })
  };
};
