import type { ActionRejectReason, ActionRunStatus, ActionTriggerType } from './ActionTypes';
import type { Environment } from './CommonTypes';

/** What every log event carries, whatever layer it came from. */
/**
 * How much a server says, from least to most: each level includes every one above it. `error` is what a production
 * server shows unless told otherwise — something went wrong — and `warn`, `info` (every request answered, every
 * plugin built) and `debug` are asked for. `silent` says nothing at all.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type ServerLogEventBase = {
  /** Wall-clock duration of the work the event describes, in milliseconds. */
  durationMs: number;
  /** False when the work threw or answered an error status. */
  ok: boolean;
  /** The error message when `ok` is false — never the request payload. */
  error?: string;
  /** ISO-8601 timestamp of when the event was emitted. */
  timestamp: string;
};

/** One HTTP request served by ANY Plitzi server — SSR pages, RSC, plugin assets, the preview endpoint, MCP —
 *  emitted by the dispatcher once the request is answered, including the ones that failed or were rejected. */
export type ServerRequestLogEvent = ServerLogEventBase & {
  kind: 'request';
  /** Which server answered — the dispatcher label, e.g. 'SSR' or 'MCP'. */
  server: string;
  method: string;
  /** Request path with query VALUES stripped and only the keys kept, e.g. '/search?q&page'. */
  path: string;
  /** The operation inside the request, when the answering stage names one — e.g. the MCP JSON-RPC method. */
  operation?: string;
  /** The HTTP status the server answered with. */
  status: number;
  /** The client the request came from, resolved through the proxies the deployment sits behind. Empty when no
   *  address could be determined. It IS personal data — see the note on {@link ServerLogEvent}. */
  clientIp?: string;
};

/** One plitzi_* tool call inside an MCP request. Reported separately from the request because a failing tool
 *  still answers HTTP 200 — the failure lives in the JSON-RPC payload, so only this event exposes it. */
export type McpToolLogEvent = ServerLogEventBase & {
  kind: 'tool';
  /** The tool name, e.g. 'plitzi_apply'. */
  name: string;
  /** A compact SHAPE summary of the arguments — keys, value types and array lengths, never values. Set
   *  `MCP_LOG_ARGS=1` to dump the real arguments instead; they may carry user content, so it stays opt-in. */
  argsSummary?: string;
};

/** One plitzi:// resource read inside an MCP request, named by the URI the request asked for. */
export type McpResourceLogEvent = ServerLogEventBase & {
  kind: 'resource';
  /** The resource URI that was read, e.g. 'plitzi://element/hero_1'. */
  name: string;
};

/** One server action run that STARTED — completed, failed or aborted.
 *
 *  Its own event rather than a line on the request that triggered it, for the same reason a tool call is: the
 *  request is answered either way, and a run started by a schedule or a webhook has a request that says nothing
 *  about it. Where the request log answers "was this call served", this answers "what did the flow do".
 *
 *  Carries the SHAPE of the run and never its data: which steps ran and how each ended, never what they
 *  returned. A refused run is absent by design — a 409 is not a run, and logging one buries the real ones under
 *  retries. */
export type ActionRunLogEvent = ServerLogEventBase & {
  kind: 'run';
  /** The action's identifier, as the space stores it. */
  name: string;
  spaceId: number;
  environment: Environment;
  /** What started it: a page call, a webhook, a schedule, a render, a trigger the deployment mounted. */
  trigger: ActionTriggerType;
  status: ActionRunStatus;
  /** Who asked, when a session carried it. Absent for a webhook, a schedule or an anonymous visitor. */
  userId?: number;
  /** Each step as `action:status`, in order — enough to see where a flow stopped without keeping what it held. */
  steps: string[];
};

/** One request that was REFUSED before it became a run — a webhook whose signature did not verify, a caller over
 *  its rate limit, an action nobody may start.
 *
 *  Separate from {@link ActionRunLogEvent} because it is a different question: that one says what a flow did,
 *  this one says why a flow never happened. It is the only place an integration that is failing at the door
 *  shows up at all — the request log answers 401 and says nothing about which check refused it.
 *
 *  `durationMs` is 0 and `ok` is always false: nothing ran, and a refusal is not a success on anybody's dashboard. */
export type ActionRejectLogEvent = ServerLogEventBase & {
  kind: 'reject';
  /** The action's identifier, as the request named it — it need not exist. */
  name: string;
  spaceId: number;
  environment: Environment;
  trigger: ActionTriggerType;
  /** Which check refused it. */
  reason: ActionRejectReason;
  /** Who asked, as the transport identifies them — a session subject or an address. */
  callerId?: string;
};

/** Everything a Plitzi server reports about the work it does, as ONE stream: the HTTP requests it answers, plus
 *  the MCP tool calls, resource reads and server-action runs that happen inside them. Wire a single sink via
 *  `SSRServerConfig.logger` and switch on `kind` — a consumer can render it, ship it to a dashboard or drop the
 *  kinds it does not want.
 *
 *  Payload-free by construction: no headers, cookies, tokens nor request body ever reach an event, query values
 *  are stripped from paths, tool arguments are reduced to their shape and a run to its steps. Two fields are NOT
 *  anonymous and a consumer shipping these events must handle them accordingly: `clientIp` on a request event, and
 *  the request path, which is kept verbatim because it is what makes the log usable. */
/** Anything else the server has to say — a plugin rebuilt, a manifest that would not load — at its own level. */
export type ServerMessageLogEvent = {
  kind: 'message';
  level: LogLevel;
  /** What is speaking: `SSR`, `RSC`, `Actions`, `auth`… — what a line used to start with in brackets. */
  scope: string;
  message: string;
  ok: boolean;
  error?: string;
  timestamp: string;
};

export type ServerLogEvent =
  | ServerRequestLogEvent
  | McpToolLogEvent
  | McpResourceLogEvent
  | ActionRunLogEvent
  | ActionRejectLogEvent
  | ServerMessageLogEvent;

/** The sink a consumer provides to receive every {@link ServerLogEvent} (see `SSRServerConfig.logger`). */
export type ServerLogger = (event: ServerLogEvent) => void;
