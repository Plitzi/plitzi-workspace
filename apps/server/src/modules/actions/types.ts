import type {
  ActionEntry,
  ActionLimits,
  ActionRunStatus,
  ActionTriggerType,
  ConnectorManifest,
  Environment,
  InteractionCallbackParam,
  InteractionNode,
  SSRUser
} from '@plitzi/sdk-shared';

/** Resolved secret material, as the connector engine already models it. */
export type ActionCredential = Record<string, string>;

/**
 * How the server reaches a space's actions. Structurally identical in spirit to `ConnectorLookups`: the module
 * never learns where a deployment stores anything.
 */
export type ActionLookups = {
  getAction: (spaceId: number, actionId: string) => Promise<ActionEntry | undefined>;
  /** Only the builder's catalog and the MCP need the list; the invocation path never calls it. */
  listActions?: (spaceId: number) => Promise<ActionEntry[]>;
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
  connector: (connectorId: string) => Promise<ConnectorManifest | undefined>;
  fetch: typeof fetch;
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
  fetchImpl?: typeof fetch;
};

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
