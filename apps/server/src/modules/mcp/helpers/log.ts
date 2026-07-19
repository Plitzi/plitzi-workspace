// Opt-in request logging for the MCP server. The service is stateless and otherwise silent, which makes debugging a
// live agent session hard (you cannot see what it called or why a call failed). Set MCP_DEBUG=1 to emit one compact
// line per tool call and resource read — off by default so production stays quiet. Mirrors the ALIAS_LOADER_DEBUG=1
// convention already used in this app.
const MCP_DEBUG = process.env.MCP_DEBUG === '1';

export const mcpDebugEnabled = (): boolean => MCP_DEBUG;

// A one-line, truncated JSON summary of a call's args — enough to identify the call without dumping a whole batch.
const summarize = (value: unknown, max = 300): string => {
  if (value === undefined) {
    return '';
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

const line = (kind: string, name: string, detail: string, ms: number, error?: unknown): void => {
  const status = error ? `ERROR ${errorText(error)}` : 'ok';
  const suffix = detail ? ` ${detail}` : '';

  console.log(`[mcp] ${kind} ${name}${suffix} ${Math.round(ms)}ms ${status}`);
};

export const logToolCall = (name: string, args: unknown, ms: number, error?: unknown): void => {
  if (MCP_DEBUG) {
    line('tools/call', name, summarize(args), ms, error);
  }
};

export const logResourceRead = (uri: string, ms: number, error?: unknown): void => {
  if (MCP_DEBUG) {
    line('resources/read', uri, '', ms, error);
  }
};
