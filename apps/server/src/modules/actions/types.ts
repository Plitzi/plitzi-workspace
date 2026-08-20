import type {
  ActionEntry,
  ActionLimits,
  ActionRunRecord,
  ActionRunStatus,
  ActionTriggerType,
  ConnectorManifest,
  Environment,
  InteractionCallbackParam,
  InteractionNode,
  InteractionNodeStatus,
  SSRUser
} from '@plitzi/sdk-shared';

/** Resolved secret material, as the connector engine already models it. */
export type ActionCredential = Record<string, string>;

/**
 * A connector with its secret already resolved.
 *
 * Handed over as one thing because the engine needs both, and a task holding only the manifest would have to go
 * looking for the credential itself — which is exactly the lookup that must not be open to a task. Authorizing
 * the connector authorizes the credential it names: that is what the `/_action` write endpoint has always done.
 */
export type ResolvedConnector = {
  manifest: ConnectorManifest;
  credential?: ActionCredential;
};

/**
 * A connection to a database that is NOT this deployment's.
 *
 * Registered by the deployment, one per engine it supports, and reached only through a credential the space
 * declared — which is the whole security position of `db.query`: a flow queries a database its owner configured,
 * never the one holding other tenants' spaces.
 *
 * `params` are BOUND, never interpolated. The task refuses a statement containing a template for exactly that
 * reason, and a driver that pastes them into the SQL itself would undo the rule from the other end.
 */
export type ActionDbDriver = {
  /** Engine name a credential names, e.g. `mysql`, `postgres`. */
  engine: string;
  query: (dsn: string, sql: string, params: unknown[], signal: AbortSignal) => Promise<unknown[]>;
};

/**
 * A namespaced key/value store for the `kv` tasks.
 *
 * The seam a deployment fills with Redis. The in-process default is honest for one replica, and making it a seam
 * is what keeps rate limiting and idempotency across replicas a deployment decision rather than a silent no-op.
 */
export type ActionKvStore = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  increment: (key: string, amount: number, ttlSeconds?: number) => Promise<number>;
};

/**
 * How the server reaches a space's actions. Structurally identical in spirit to `ConnectorLookups`: the module
 * never learns where a deployment stores anything.
 */
/**
 * Which published version of a space is asking. Absent means the live document, the one the builder edits.
 *
 * A page carries the revision it was published at, and a run it starts must read the action AS OF that revision —
 * otherwise a page shipped yesterday runs whatever the flow says today. A run that no page started (a webhook, a
 * schedule) has no revision to speak of and reads the live one.
 */
export type ActionRevision = { environment: Environment; revision: number };

export type ActionLookups = {
  getAction: (spaceId: number, actionId: string, at?: ActionRevision) => Promise<ActionEntry | undefined>;
  /** Only the builder's catalog, the MCP and the scheduler need the list; a page call never asks for it. */
  listActions?: (spaceId: number, at?: ActionRevision) => Promise<ActionEntry[]>;
  getCredential?: (spaceId: number, identifier: string) => Promise<ActionCredential | undefined>;
  getConnector?: (spaceId: number, connectorId: string) => Promise<ConnectorManifest | undefined>;
};

/**
 * The only door a task has to the outside world.
 *
 * `credential` and `connector` answer solely for identifiers the running document declared, so a task cannot reach
 * a secret the action did not ask for — the check lives here rather than in each task, where it would be optional.
 * `fetch` is the run's own: abort-wired and counted against the request budget.
 */
export type ActionTaskContext = {
  runId: string;
  spaceId: number;
  environment: Environment;
  trigger: ActionTriggerType;
  user?: SSRUser;
  signal: AbortSignal;
  /**
   * The flow scope as the current node sees it: `input`, every previous node's result by id, `user`, and the
   * credentials the document declared. Read-only, and present because a `rawParams` task has to render templates
   * against something.
   */
  scope: Readonly<Record<string, unknown>>;
  credential: (identifier: string) => Promise<ActionCredential | undefined>;
  connector: (connectorId: string) => Promise<ResolvedConnector | undefined>;
  fetch: typeof fetch;
  /** Key/value storage, namespaced to this space by the runner — a key one space writes is a key only it reads. */
  kv: ActionKvStore;
  /** The database engines this deployment registered, for the `db.query` task. */
  dbDrivers: ActionDbDriver[];
  /** Pushes a `data` frame to a streaming caller. A no-op when nobody negotiated a stream. */
  emit: (chunk: unknown) => void;
};

/**
 * One step a server action can take.
 *
 * `params` is the same `InteractionCallbackParam` map the builder's WorkflowNode already renders, which is what
 * lets a deployment's own task appear in its editor without a single change there.
 */
export type ActionTask<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** Addressed in a node as `<namespace>.<action>`. */
  namespace: string;
  action: string;
  title: string;
  description?: string;
  params: Record<keyof T, InteractionCallbackParam<T>>;
  /**
   * Receive params BEFORE twig resolution. Only for a task whose whole job is to render a template — resolving
   * first would consume the very tokens it exists to interpret. The client engine special-cases `twigTemplate` by
   * name for this; a flag is the same rule without the name check.
   */
  rawParams?: boolean;
  run: (params: T, ctx: ActionTaskContext) => unknown;
};

/** A task with its addressable name resolved, as the registry stores and lists it. */
export type RegisteredTask = ActionTask<Record<string, unknown>> & { name: string };

export type ActionTaskRegistry = {
  get: (name: string) => RegisteredTask | undefined;
  list: () => RegisteredTask[];
};

/** What a deployment hands to `createServer` under `actions`. Absent → the module is never constructed. */
export type ActionsConfig = {
  lookups: ActionLookups;
  /** Deployment-owned tasks, validated at boot against the built-ins. */
  tasks?: ActionTask<never>[];
  /** Ceilings a per-action document may tighten but never exceed. */
  limits?: ActionLimits;
  /** How many runs may be in flight at once. Counted per space and for the process as a whole. */
  concurrency?: { perSpace?: number; perProcess?: number };
  /** Backs the `kv` tasks. Omitted → an in-process store, which is per-replica by definition. */
  kv?: ActionKvStore;
  /** Inbound webhooks are public, so they are counted per caller per minute. Default 60. */
  rateLimit?: { webhookPerMinute?: number };
  /** Database engines this deployment lets a flow reach. Empty → the `db.query` task is not offered at all. */
  dbDrivers?: ActionDbDriver[];
  /**
   * Called once per run that started, for a deployment that keeps a record.
   *
   * Best-effort by contract: it is awaited but never allowed to fail a run — a logging outage must not take an
   * action down, which is the same rule metering follows.
   */
  onRun?: (record: ActionRunRecord) => void | Promise<void>;
  fetchImpl?: typeof fetch;
};

/** Re-exported so the module's own files import one place, and a deployment writing an `onRun` sees the same
 *  shape the runner emits. */
export type { ActionRunRecord } from '@plitzi/sdk-shared';

export type ResolvedActionLimits = Required<ActionLimits>;

export type ActionRunRequest = {
  entry: ActionEntry;
  input: Record<string, unknown>;
  spaceId: number;
  environment: Environment;
  trigger: ActionTriggerType;
  user?: SSRUser;
  runId: string;
  /** Chain of run ids that caused this one; a run naming its own action is refused before its first node. */
  lineage?: string[];
  emit?: (chunk: unknown) => void;
  /** Reports each step as it settles, for a caller watching the run happen. Absent for a plain request/response. */
  onNode?: (id: string, status: InteractionNodeStatus) => void;
  signal?: AbortSignal;
};

export type ActionRunResult = {
  runId: string;
  status: ActionRunStatus;
  /** Projected down to the document's declared `output`. Never the raw flow scope. */
  output: Record<string, unknown>;
  /** The same shape the dev-tools Interactions panel renders. Redacted before it leaves the process. */
  trace: InteractionNode[];
};
