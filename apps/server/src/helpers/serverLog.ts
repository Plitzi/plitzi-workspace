import type { ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

const outcomeOf = (event: ServerLogEvent): string => (event.ok ? 'ok' : `ERROR ${event.error ?? ''}`.trim());

const renderRequest = (event: Extract<ServerLogEvent, { kind: 'request' }>): string => {
  const client = event.clientIp ? `${event.clientIp} ` : '';
  const operation = event.operation ? ` ${event.operation}` : '';
  const timing = `${Math.round(event.durationMs)}ms`;

  return `[${event.server}] ${client}${event.method} ${event.path}${operation} ${event.status} ${timing} ${outcomeOf(event)}`;
};

const renderTool = (event: Extract<ServerLogEvent, { kind: 'tool' }>): string => {
  const args = event.argsSummary ? ` ${event.argsSummary}` : '';

  return `[MCP] tools/call ${event.name}${args} ${Math.round(event.durationMs)}ms ${outcomeOf(event)}`;
};

const renderResource = (event: Extract<ServerLogEvent, { kind: 'resource' }>): string =>
  `[MCP] resources/read ${event.name} ${Math.round(event.durationMs)}ms ${outcomeOf(event)}`;

/** The steps go on the line only when the run ended badly. On a run that worked they are noise on every single
 *  call; on one that did not they are the answer — which step stopped, and what the ones before it did. */
const renderRun = (event: Extract<ServerLogEvent, { kind: 'run' }>): string => {
  const steps = event.ok || event.steps.length === 0 ? '' : ` [${event.steps.join(' → ')}]`;

  return `[Action] ${event.name} via ${event.trigger} space=${event.spaceId} ${event.status} ${Math.round(event.durationMs)}ms ${outcomeOf(event)}${steps}`;
};

/** A refusal reads as what refused it: `[Action] checkout via webhook space=1 REFUSED invalid_signature`. The
 *  reason is the whole point of the line — "401" is what the request log already said. */
const renderReject = (event: Extract<ServerLogEvent, { kind: 'reject' }>): string => {
  const caller = event.callerId ? ` from ${event.callerId}` : '';

  return `[Action] ${event.name} via ${event.trigger} space=${event.spaceId} REFUSED ${event.reason}${caller} ${outcomeOf(event)}`;
};

/** One line for any {@link ServerLogEvent}: an HTTP request reads as an access-log line
 *  (`[SSR] 203.0.113.7 GET /pricing 200 12ms ok`), the MCP events as what happened inside one
 *  (`[MCP] tools/call plitzi_apply {operations:[3]} 41ms ok`), a server action as what its flow did
 *  (`[Action] shipping-quote via call space=1 completed 12ms ok`) and a refused one as what turned it away
 *  (`[Action] checkout via webhook space=1 REFUSED invalid_signature`). Rendering is a pure format — the dispatcher
 *  already stripped query values, collected no headers, cookies or tokens, summarised tool args by shape and
 *  reduced a run to its steps; the client IP it does carry is personal data, so a sink that persists these lines
 *  must say so. */
export const renderLogEvent = (event: ServerLogEvent): string => {
  switch (event.kind) {
    case 'request':
      return renderRequest(event);
    case 'tool':
      return renderTool(event);
    case 'resource':
      return renderResource(event);
    case 'run':
      return renderRun(event);
    case 'reject':
      return renderReject(event);
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
