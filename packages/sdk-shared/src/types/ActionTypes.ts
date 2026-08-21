import type { Environment } from './CommonTypes';
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
 * Who may start a run through ONE way in. Resolved against the auth kernel (RFC 0010) — never re-implemented here.
 *
 * It belongs to the trigger and not to the action, because the two are different questions: a webhook is reachable
 * by anyone who learns its URL and is gated on its signature, while the same flow called from a page may well
 * require a session. Stating it once for the action forced the loosest of its ways in onto all of them.
 *
 * There is no implicit default: a trigger that declares no access is refused at save time rather than falling back
 * to something a reader has to guess at.
 */
export type ActionAccess =
  /** Anyone, including an anonymous visitor. Implicit for a webhook; anywhere else it is a deliberate choice. */
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
  /** The credential holding the signing secret. Named outright rather than templated: this runs before anything
   *  else does, and a token that renders to nothing here is an endpoint that verifies against an empty secret. */
  credential: string;
  /** Which key of that credential is the secret. Defaults to `secret`. */
  secretField?: string;
  /**
   * Header carrying the moment the sender signed, when it sends one separately (the Stripe shape). The signed
   * payload is then `<timestamp>.<body>` rather than the body alone.
   *
   * Without it `toleranceSeconds` has nothing to compare against: a signature over the body alone is valid
   * forever, so a captured request can be replayed until the secret rotates.
   */
  timestampHeader?: string;
  /** Rejects a signature older than this many seconds. Needs `timestampHeader`. */
  toleranceSeconds?: number;
};

/**
 * The ways into an action, as the `action` of a trigger STEP rather than a list beside the flow.
 *
 * `call` — a client flow through the action endpoint. `webhook` — an inbound request, public by construction.
 * `schedule` — a cron tick. `render` — a `runtime: 'server'` element naming this action. `custom` — a trigger the
 * deployment mounted itself.
 */
export type ActionTriggerType = 'call' | 'webhook' | 'schedule' | 'render' | 'custom';

/**
 * What a trigger step carries, in its `params`.
 *
 * FLAT and stringy, because that is what a step's params are everywhere in this product: the flow editor renders
 * `text`, `select` and `codemirror-json` controls over primitives, and a trigger authored anywhere else would be a
 * second editor to build and to keep in step. So the two contracts an action has are both JSON on a step — `input`
 * here, and the output step's `values` at the other end.
 *
 * Read it with the helpers in `@plitzi/sdk-shared/actions` rather than by hand: they are what the validator and
 * the runner share, so what the editor accepts is exactly what the runner will do.
 */
export type ActionTriggerParams = {
  /** Who may start a run this way. Required for every kind but `schedule`, which has no caller. */
  access?: ActionAccess['mode'];
  /** Comma-separated, and only meaningful for `access: 'role'`. */
  permissions?: string;
  /** JSON map of {@link ActionField} by name: what a caller may send THIS way. Undeclared keys are dropped. */
  input?: string;
  /** `webhook`: JSON {@link ActionWebhookVerification}. Absent means an endpoint anyone who learns it can start. */
  verify?: string;
  /** `schedule`: five fields — minute hour day-of-month month day-of-week. UTC. */
  cron?: string;
  timezone?: string;
  /** `custom`: the name the deployment mounts it under. */
  name?: string;
};

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
 * It is the SAME document an element's interactions are — a map of steps, each naming a task, chained by
 * `afterNode` — and it is deliberately nothing more. Everything that used to be declared beside the flow now lives
 * on the step that starts it, so there is one place to read and one place to author, and the editor is the one
 * already in the product.
 *
 * It lives in shared types because the builder authors the very document the server executes — the same reason
 * `ConnectorManifest` does. It is server-side state: it goes to the BUILDER, which is authorized to edit it, and
 * never into a page. What a visitor's page holds is the action's identifier, and what it gets back is whatever the
 * output step named.
 *
 * There is no `enabled` here. Whether an action can run is whether any way INTO it is switched on, and that switch
 * is the trigger step's own — one per way in, which is finer than one per action and is the control an author
 * actually reaches for. A field beside the flow was the same fact written twice, with no rule for which won.
 * Read it with `isActionEnabled` from `@plitzi/sdk-shared/actions`.
 */
export type ActionDocument = {
  name: string;
  description?: string;
  /**
   * The flows. One or more `trigger` steps, each heading a chain of `task` steps — the same node map an element's
   * `interactions` holds, so one editor authors both.
   */
  nodes: Record<string, ElementInteraction>;
  /**
   * The keys the `flow.output` step names, DERIVED from it — never authored beside it.
   *
   * It exists so the builder can offer typed bindings on a call's result without opening the flow. Declaring it by
   * hand was the original design and it was wrong: it asks an author to know what a flow returns before the steps
   * that produce it exist, and it leaves two places to keep in step. The runner ignores this entirely and answers
   * exactly what the output step named.
   */
  output?: Record<string, ActionField>;
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
 * One server task, as the builder's flow editor receives it.
 *
 * The catalog is served by the deployment rather than hardcoded, which is what lets a self-hoster's own task show
 * up in their editor. `params` is the same `InteractionCallbackParam` map an interaction callback declares — but
 * anything function-valued in it (a `when`, options computed from another param) does not survive the wire, so a
 * task meant to be authored visually declares static params.
 */
export type ActionTaskDescriptor = {
  name: string;
  namespace: string;
  action: string;
  title: string;
  description?: string;
  params: Record<string, unknown>;
};

/**
 * One run as an authoring caller receives it — the builder's test run.
 *
 * `trace` is the same `InteractionNode[]` the dev-tools panel renders, redacted of credential values. A visitor
 * never sees it; an author looking at their own flow should see nothing less than the steps that ran.
 */
export type ActionRunReport = {
  runId: string;
  status: ActionRunStatus;
  output: Record<string, unknown>;
  trace: Record<string, unknown>[];
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

/**
 * What one run was, for whoever keeps the record.
 *
 * Emitted for every run that STARTED — completed, failed or aborted — and never for one refused before it began:
 * a 409 is not a run, and logging it would bury the real ones under retries.
 *
 * Deliberately not the trace: step results are the space's own data and can be large, so what travels here is the
 * shape of what happened. The trace goes to the author who asked for it, in the test-run panel.
 */
export type ActionRunRecord = {
  runId: string;
  actionId: string;
  spaceId: number;
  environment: Environment;
  trigger: ActionTriggerType;
  status: ActionRunStatus;
  durationMs: number;
  /** Who asked, when a session carried it. Absent for a webhook, a schedule or an anonymous visitor. */
  userId?: number;
  /** One entry per step that ran, in order — enough to see where a flow stopped without keeping its data. */
  nodes: { id: string; action: string; status: string }[];
  /** Present when the run ended badly. Already redacted of credential values. */
  error?: string;
};

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
