import type { ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

const outcomeOf = (event: ServerLogEvent): string => (event.ok ? 'ok' : `ERROR ${event.error ?? ''}`.trim());

const renderRequest = (event: Extract<ServerLogEvent, { kind: 'request' }>): string => {
  const operation = event.operation ? ` ${event.operation}` : '';
  const timing = `${Math.round(event.durationMs)}ms`;

  return `[${event.server}] ${event.method} ${event.path}${operation} ${event.status} ${timing} ${outcomeOf(event)}`;
};

const renderTool = (event: Extract<ServerLogEvent, { kind: 'tool' }>): string => {
  const args = event.argsSummary ? ` ${event.argsSummary}` : '';

  return `[mcp] tools/call ${event.name}${args} ${Math.round(event.durationMs)}ms ${outcomeOf(event)}`;
};

const renderResource = (event: Extract<ServerLogEvent, { kind: 'resource' }>): string =>
  `[mcp] resources/read ${event.name} ${Math.round(event.durationMs)}ms ${outcomeOf(event)}`;

/** One line for any {@link ServerLogEvent}: an HTTP request reads as an access-log line
 *  (`[SSR] GET /pricing 200 12ms ok`), the MCP events as what happened inside one
 *  (`[mcp] tools/call plitzi_apply {operations:[3]} 41ms ok`). Events arrive PII-free — the dispatcher strips
 *  query values and collects no headers, cookies or IPs, and tool args are summarised by shape — so rendering is
 *  a pure format. */
export const renderLogEvent = (event: ServerLogEvent): string => {
  switch (event.kind) {
    case 'request':
      return renderRequest(event);
    case 'tool':
      return renderTool(event);
    case 'resource':
      return renderResource(event);
  }
};

/** A drop-in `SSRServerConfig.logger` for consumers that just want the log on the console. Consumers with their
 *  own logging stack should pass their own sink instead and read the structured event. */
export const consoleLogger: ServerLogger = event => {
  const line = renderLogEvent(event);
  if (event.ok) {
    console.log(line);
  } else {
    console.error(line);
  }
};
