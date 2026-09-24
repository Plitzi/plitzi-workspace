import type { LogLevel, ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

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

const renderMessage = (event: Extract<ServerLogEvent, { kind: 'message' }>): string =>
  `[${event.scope}] ${event.message}${event.error ? `: ${event.error}` : ''}`;

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
    case 'message':
      return renderMessage(event);
  }
};

const RANK: Record<LogLevel | 'silent', number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

/**
 * How severe an event is: what it says it is, or — for a request, a tool call, a run — whether it went wrong. A
 * refusal is never `ok` yet never the server's failure: the caller was turned away, which is a `warn`.
 */
export const logLevelOf = (event: ServerLogEvent): LogLevel => {
  if (event.kind === 'message') {
    return event.level;
  }

  if (event.kind === 'reject') {
    return 'warn';
  }

  return event.ok ? 'info' : 'error';
};

/** Whether a server at `threshold` says something at `level`. */
export const isLogged = (threshold: LogLevel | 'silent', level: LogLevel): boolean => RANK[level] <= RANK[threshold];

/** What a server says when the deployment did not choose: what went wrong in production, more while developing. */
export const defaultLogLevel = (devMode = false): LogLevel => (devMode ? 'info' : 'error');

/** A drop-in `SSRServerConfig.logger` for consumers that just want the log on the console. Consumers with their
 *  own logging stack should pass their own sink instead and read the structured event. */
export const consoleLogger: ServerLogger = event => {
  const line = renderLogEvent(event);
  const level = logLevelOf(event);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const errorText = (cause: unknown): string =>
  cause instanceof Error ? (cause.stack ?? cause.message) : typeof cause === 'string' ? cause : JSON.stringify(cause);

/**
 * Where everything the server says that is not a request goes — one threshold and one sink for the process.
 *
 * Process-wide because what speaks is often created before any server exists (an adapter, a job worker) and has no
 * config to read. `createServer` sets it from its own `logLevel` and `logger`; until then it is `error` under
 * `NODE_ENV=production` and `info` otherwise, to the console.
 */
const state: { level: LogLevel | 'silent'; sink: ServerLogger } = {
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  sink: consoleLogger
};

export const configureServerLog = (options: { level: LogLevel | 'silent'; logger?: ServerLogger }): void => {
  state.level = options.level;
  state.sink = options.logger ?? consoleLogger;
};

const say = (level: LogLevel, scope: string, message: string, cause?: unknown): void => {
  if (!isLogged(state.level, level)) {
    return;
  }

  state.sink({
    kind: 'message',
    level,
    scope,
    message,
    ok: level !== 'error',
    ...(cause === undefined ? {} : { error: errorText(cause) }),
    timestamp: new Date().toISOString()
  });
};

/** The server's own voice: `serverLog.error('RSC', 'element failed to resolve', error)`. Below the threshold, nothing. */
export const serverLog = {
  error: (scope: string, message: string, cause?: unknown) => say('error', scope, message, cause),
  warn: (scope: string, message: string, cause?: unknown) => say('warn', scope, message, cause),
  info: (scope: string, message: string, cause?: unknown) => say('info', scope, message, cause),
  debug: (scope: string, message: string, cause?: unknown) => say('debug', scope, message, cause),
  /** Whether a level would be said — to skip building a costly message nobody will read. */
  enabled: (level: LogLevel): boolean => isLogged(state.level, level),
  /** Hands an event to a sink the consumer wired itself (`onRun`, `onReject`) only when the process would say it. */
  emit: (logger: ServerLogger, event: ServerLogEvent): void => {
    if (isLogged(state.level, logLevelOf(event))) {
      logger(event);
    }
  }
};
