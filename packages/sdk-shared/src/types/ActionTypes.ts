import type { Environment } from './CommonTypes';
import type { InteractionNodeStatus } from './InteractionTypes';
import type { ElementInteraction } from './SchemaTypes';
import type { SmtpSettings } from '../actions/smtp';

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
 * Who may start a run through ONE way in. Resolved against the auth kernel — never re-implemented here.
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
  /**
   * `webhook`: the credential holding the signing secret.
   *
   * **Naming one is what turns verification on**, and it is the only field that has to be set — everything below
   * has a default that works. That is deliberate: a half-filled verification is an endpoint that looks protected
   * and is not, so the shape does not allow one. Absent means an endpoint anyone who learns the URL can start,
   * which the validator warns about.
   */
  signatureCredential?: string;
  /** Header the signature arrives in. Defaults to `x-signature`; a provider that uses its own says so here. */
  signatureHeader?: string;
  /** `sha256` (the default) or `sha1`. */
  signatureAlgorithm?: string;
  /** Which key of the credential holds the secret. Defaults to `secret`. */
  signatureSecretField?: string;
  /**
   * Header carrying the moment the sender signed, when it sends one separately (the Stripe shape). The signed
   * payload is then `<timestamp>.<body>` rather than the body alone.
   */
  signatureTimestampHeader?: string;
  /** Rejects a signature older than this many seconds. Means nothing without the timestamp header. */
  signatureToleranceSeconds?: string;
  /**
   * `render`: how long an answer may be reused, in seconds. Absent or `0` means every render runs the flow.
   *
   * It belongs to the trigger for the same reason access does: it is a property of THIS way in. A call is
   * somebody asking for something to happen and must not be served from a cache; a render is a read repeated
   * once per visitor, and the difference between one outbound request and ten thousand of them is this number.
   *
   * Renders that arrive while one is already in flight are answered by it whatever this says — that is not a
   * cache, it is the same run being shared, and it can never serve an answer older than the request.
   */
  cacheSeconds?: string;
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
  /**
   * Bytes one outbound response may carry back into a flow.
   *
   * A timeout does not cover this: a backend answering a gigabyte quickly is a fast way to take a process down,
   * and every other ceiling here is about how LONG a run may take rather than how much it may hold. Counted per
   * response rather than per run, because it exists to stop one answer from being unbounded.
   */
  maxResponseBytes?: number;
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
  /**
   * Nobody was signed in and the trigger asked for somebody.
   *
   * Separate from `forbidden` because the two ask different things of the caller: this one says "sign in again",
   * and it is usually a session that ended under a page that still believes it has one — so the client reports it
   * to auth, which renews or signs the visitor out at once. `forbidden` says "not you", and reading that as a dead
   * session would sign out somebody who is merely short a permission.
   */
  | 'unauthenticated'
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
 * Why a request never became a run.
 *
 * A superset of {@link ActionErrorReason}: everything a run can be refused for, plus what only an inbound
 * webhook can be refused for — the checks that happen before there is a document to run at all. They are named
 * separately because they are the ones an author has to be able to SEE: a signature that does not match is a
 * misconfiguration somebody has to fix, and it is indistinguishable from silence unless it is reported.
 */
export type ActionRejectReason =
  | ActionErrorReason
  /** The signature did not verify against the raw body. */
  | 'invalid_signature'
  /** This caller sent more deliveries this minute than the deployment allows. */
  | 'rate_limited'
  /** The body was not JSON. */
  | 'malformed_body'
  /** The trigger carries a signature check in a shape nothing reads, so the endpoint fails closed. */
  | 'unverifiable';

/**
 * A request that was refused before it became a run.
 *
 * The counterpart to {@link ActionRunRecord}, and the reason it exists: `onRun` reports runs that STARTED, so a
 * webhook rejected for a bad signature — the single most common way an integration is broken — produced nothing
 * anybody could look at. Whether a refusal is worth keeping is the deployment's call: a duplicate delivery is a
 * well-behaved sender retrying and is noise, while an invalid signature is somebody's afternoon. The mechanism
 * reports all of them and filters none.
 *
 * Never carries the body or the signature. What went wrong is `detail`, in the server's own words.
 */
export type ActionRejectRecord = {
  actionId: string;
  spaceId: number;
  environment: Environment;
  trigger: ActionTriggerType;
  reason: ActionRejectReason;
  /** Why, for whoever has to fix it. Never the offending value itself. */
  detail?: string;
  /** Who asked, as the transport identifies them — a session subject or an address. */
  callerId?: string;
};

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
  /** When the run started, epoch ms. */
  startedAt: number;
  durationMs: number;
  /** Who asked, when a session carried it. Absent for a webhook, a schedule or an anonymous visitor. */
  userId?: number;
  /**
   * Every step that ran, in order, as a debugger may see it — enough to see where a flow stopped, how long each step
   * took and why one failed, without keeping anything a step was given or returned.
   */
  steps: ActionRunStep[];
  /** Present when the run ended badly. Already redacted of credential values. */
  error?: string;
};

/**
 * One step of a server action run, as a debugger may show it to anybody allowed to debug the page.
 *
 * What ran, in what order, how it ended and how long it took — never what the step was given or what it returned.
 * Those can hold another visitor's data or a flow's internals (an endpoint, a query), so they stay in the full trace,
 * which only authoring requests and development servers receive.
 */
export type ActionRunStep = {
  id: string;
  title: string;
  /** The task it ran, e.g. `kv.increment`. */
  action: string;
  status: InteractionNodeStatus;
  /** `undo` for `flow.onFailure` and the steps after it: they ran because the flow before them failed. */
  phase: 'flow' | 'undo';
  startTime: number;
  endTime: number;
  /** Why it failed, redacted of every credential value the run resolved. */
  error?: string;
};

/**
 * A run a page RENDER started, reported to a page whose debugging is authorized.
 *
 * Nobody in the browser sent it — the server ran it while building the page, or while answering a refresh — so this is
 * the only way it reaches a debugger. The same outline a call reports, and nothing more.
 */
export type ActionRunSummary = {
  actionId: string;
  runId: string;
  trigger: 'render';
  status: ActionRunStatus;
  /** The server element it fed. */
  elementId?: string;
  startedAt: number;
  endedAt: number;
  steps: ActionRunStep[];
  /** Why a run ended before its steps could say — a deadline, a refusal. Never a provider's own message. */
  error?: string;
};

/**
 * One message a flow asked to send.
 *
 * Plain text only. The body is whatever a flow rendered, and a flow renders what a visitor typed: HTML built from
 * that is markup a stranger wrote, sent from the space's own domain.
 */
export type ActionEmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/** One message on its way out, as a deployment's own transport receives it. */
export type ActionEmailDelivery = {
  /** The space the run belongs to, for a transport that routes or attributes mail per space. */
  spaceId: number;
  /** The SMTP credential the step named, already judged by `readSmtpCredential`. */
  smtp: SmtpSettings;
  message: ActionEmailMessage;
  /** Aborted when the run is. The run ends either way; a transport that ignores it may still let the message leave. */
  signal: AbortSignal;
};

/**
 * How a message leaves, when the deployment decides that rather than `sdk-server`.
 *
 * Without one the server opens an SMTP connection to the credential's host itself — resolved, judged against private
 * networks, connected by address. A deployment that routes mail its own way — a relay pool, a provider's API, a capture
 * in tests — supplies this and owns that connection, and with it the network rule. What stays the server's: the step's
 * checks on the message, the credential being judged, and the daily limit counted before this is called. Throwing
 * fails the step with that message.
 */
export type ActionEmailTransport = (delivery: ActionEmailDelivery) => Promise<void>;

/**
 * What a deployment decides about the mail its spaces' flows send through their own SMTP credentials.
 *
 * The server is still the one sending, from the deployment's addresses — so how much one space may send, whether a
 * credential may point inside the deployment's own network, and how a message leaves are the deployment's to say.
 */
export type ActionEmailConfig = {
  /** Messages one space may send per UTC day, counted before each send. Default 200. */
  dailyLimitPerSpace?: number;
  /**
   * Lets an SMTP credential name a host on a private network — `localhost`, `10.x`, `192.168.x`. Off by default:
   * a hosted server refuses them, because a credential is typed by a customer and the connection starts inside the
   * cluster. On for a development mail catcher, or a self-hosted server whose relay lives beside it. Only consulted
   * when the server opens the connection itself, which is when there is no `transport`.
   */
  allowPrivateHosts?: boolean;
  /** Replaces the server's own SMTP connection. See {@link ActionEmailTransport}. */
  transport?: ActionEmailTransport;
};

/**
 * One thing a CHECK found about an action, before anybody runs it.
 *
 * The complement to `validateActionDocument`, which reads the document alone and therefore cannot know whether
 * the credential a step names exists, whether this server registers that task, or whether the cron would ever
 * fire. Those are the failures that only show up at 3am on the first real delivery, and they are exactly what an
 * author cannot see from the editor.
 */
export type ActionCheckIssue = {
  /** `error` — it cannot work as written. `warning` — it will run, and somebody should know. */
  level: 'error' | 'warning';
  /** Where it is, in the same `nodes.<id>.params.<field>` shape the document validator uses. */
  path: string;
  message: string;
  hint?: string;
};

/** What the deployment answered about one action. `valid` is "nothing here is fatal", not "it will succeed". */
export type ActionCheckReport = {
  valid: boolean;
  issues: ActionCheckIssue[];
};

/**
 * One thing that happened to an action, as the builder reads it back.
 *
 * A run and a refusal in one shape, because the question an author asks is "what happened", and the most common
 * answer for a webhook is that nothing ran: the signature did not verify. `status: 'refused'` is that answer, and
 * `reason` says which check turned it away.
 *
 * Never the trace — that belongs to the test run the author asked for. A history is which steps ran and how each
 * ended, not what they held.
 */
export type ActionEvent = {
  id: string;
  actionId: string;
  runId?: string | null;
  trigger: string;
  status: ActionRunStatus | 'refused' | 'unknown';
  refused: boolean;
  reason?: ActionRejectReason | null;
  durationMs?: number | null;
  steps: string[];
  /** What went wrong, already redacted of credential values. */
  detail?: string | null;
  createdAt: number;
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
