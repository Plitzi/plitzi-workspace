import type { ElementInteraction } from './SchemaTypes';

/**
 * What an action's inputs and outputs may be.
 *
 * Deliberately NOT `CollectionField['type']`: that vocabulary describes CMS content (`richText`, `multiImage`,
 * `video`) and an action takes arguments, not entries. `json` is the escape hatch for a nested payload, and it is
 * the only one whose contents are not validated beyond being parseable.
 */
export type ActionFieldType = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'file';

export type ActionField = {
  type: ActionFieldType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  /** Shown in the builder, and read by the MCP agent when it wires a call. */
  label?: string;
};

/**
 * Who may invoke an action. Resolved against the auth kernel (RFC 0010) — never re-implemented here.
 *
 * There is no implicit default: a document that declares no access is refused at save time rather than falling back
 * to something a reader has to guess at.
 */
export type ActionAccess =
  /** Anyone, including an anonymous visitor. Required for a webhook; anywhere else it is a deliberate choice. */
  | { mode: 'public' }
  /** Any request carrying a valid session for this space. */
  | { mode: 'session' }
  /** A session holding every one of these space permissions. */
  | { mode: 'role'; permissions: string[] };

/**
 * How an inbound webhook proves it is who it claims to be. Verified against the RAW body, before parsing and before
 * the run starts — a public endpoint with no verification is a warning at save time and in the logs.
 */
export type ActionWebhookVerification = {
  type: 'hmac';
  /** Header carrying the signature, e.g. `stripe-signature`. */
  header: string;
  algorithm: 'sha256' | 'sha1';
  /** Template resolved against the declared credentials, e.g. `{{credential.stripe.webhookSecret}}`. */
  secret: string;
  /** Rejects a replayed body whose timestamp is older than this. */
  toleranceSeconds?: number;
};

export type ActionTrigger =
  /** Invoked by a client flow through the action endpoint. */
  | { type: 'call' }
  | { type: 'webhook'; verify?: ActionWebhookVerification }
  | { type: 'schedule'; cron: string; timezone?: string }
  /** Produces data during a page render, addressed by a `runtime: 'server'` element. */
  | { type: 'render' }
  /** Mounted by the deployment itself. The runner does not care who called it. */
  | { type: 'custom'; name: string };

export type ActionTriggerType = ActionTrigger['type'];

/** Ceilings for one run. A per-action value may only tighten the deployment's own. */
export type ActionLimits = {
  timeoutMs?: number;
  /** Ceiling for a streaming run, which is allowed to be longer-lived than a request/response one. */
  streamTimeoutMs?: number;
  maxNodes?: number;
  maxRequests?: number;
};

/**
 * A server action: a declarative flow, stored per space, executed by the server.
 *
 * It lives in shared types because the builder authors the very document the server executes — the same reason
 * `ConnectorManifest` does. It is server-side state and must never be serialized into a page: what the browser gets
 * is {@link ActionProjection}, derived at request time.
 */
export type ActionDocument = {
  name: string;
  description?: string;
  enabled: boolean;
  access: ActionAccess;
  triggers: ActionTrigger[];
  input: Record<string, ActionField>;
  /** The only keys a caller gets back. Everything else a node produced stays on the server. */
  output: Record<string, ActionField>;
  /** Credential identifiers this action may resolve. Its templates can reach nothing else. */
  credentials?: string[];
  /** Connector identifiers this action may call. */
  connectors?: string[];
  /** The flow itself — the same node map an element's `interactions` holds, so one editor authors both. */
  nodes: Record<string, ElementInteraction>;
  limits?: ActionLimits;
};

/**
 * An action as a server-side reader hands it over.
 *
 * `id` is stamped by the store rather than carried by the document, for the same reason `ConnectorManifestDraft`
 * drops it: a document holding its own id can disagree with the one it was fetched by.
 */
export type ActionEntry = {
  id: string;
  document: ActionDocument;
};

/**
 * The only part of an action the browser is allowed to see: enough for the builder to offer typed bindings on a
 * call's result, and nothing about what the action does. Derived server-side from the document at request time —
 * never a copy saved into the schema, which would keep whatever a later edit adds.
 */
export type ActionProjection = {
  id: string;
  name: string;
  input: Record<string, ActionField>;
  output: Record<string, ActionField>;
};

/**
 * Whether the CLIENT flow waits. The server side is synchronous in every mode: `detached` means the step does not
 * await its own request, not that the run outlives it.
 */
export type ActionCallMode = 'await' | 'detached' | 'stream';

export type ActionRunStatus = 'completed' | 'failed' | 'skipped' | 'aborted';

/**
 * Why a run did not produce an answer. Reported to the caller — and to the `onFlowError` trigger — because a guard
 * an author cannot observe is a guard they will work around.
 */
export type ActionErrorReason =
  | 'not_found'
  | 'disabled'
  | 'forbidden'
  | 'invalid_input'
  /** Another run holds this action's single-flight key. */
  | 'duplicate'
  /** A concurrency or stream cap was reached. */
  | 'over_capacity'
  /** The run's lineage already names this action: a loop through the outside world. */
  | 'recursion'
  | 'timeout'
  | 'aborted'
  | 'failed';

/** Action-addressed call. The element-addressed connector write keeps its own shape on the same endpoint. */
export type ActionCallRequest = {
  actionId: string;
  input?: Record<string, unknown>;
  /** Replaces the derived single-flight key, so a caller can make a retry provably the same run. */
  idempotencyKey?: string;
};

export type ActionCallResult = {
  runId: string;
  status: ActionRunStatus;
  output: Record<string, unknown>;
};

export type ActionCallAccepted = {
  runId: string;
  accepted: true;
};

export type ActionCallError = {
  runId?: string;
  error: string;
  reason: ActionErrorReason;
};

/** One frame of a streaming run. `node` frames are the trace arriving live; `data` frames are `stream.emit`. */
export type ActionStreamFrame =
  | { event: 'node'; data: { id: string; status: string } }
  | { event: 'data'; data: { chunk: unknown } }
  | { event: 'done'; data: ActionCallResult }
  | { event: 'error'; data: ActionCallError };
