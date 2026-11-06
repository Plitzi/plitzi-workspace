import type { JobClaimMemory, JobQueue, JobSpaces } from './jobs';
import type { SSRPageAdapters, ServerBaseConfig } from '@plitzi/sdk-kernel/types';
import type {
  ActionEmailConfig,
  ActionLimits,
  ActionRejectRecord,
  ActionRunRecord,
  Environment,
  SSRRealtimeConfig,
  Schema,
  SpaceRevision
} from '@plitzi/sdk-shared';

/** The actions engine's own configuration: its actions, its functions, its connectors and its realtime channels. */
export type EngineOptions = {
  /** Write endpoint for server-driven providers. Absent means the server serves reads only. */
  action?: SSRActionConfig;
  /**
   * The server's code: its own (`native`), the server halves of the plugins it ships (`plugins`, by plugin type), the
   * runner the spaces' code runs on, and the ceilings. Built by `@plitzi/sdk-actions/functions` (`loadFunctions`), and
   * checked as the server starts.
   */
  functions?: {
    native?: unknown[];
    /** Say an invocation of `native` that spends more than a sandbox would let it (sdk-server's `FunctionsConfig`). */
    measureNative?: boolean;
    plugins?: Record<string, unknown>;
    runner?: unknown;
    limits?: Record<string, number>;
    /** What the spaces' jobs may spend, per space (its plan): see `FunctionJobLimits` in `@plitzi/sdk-actions/functions`. */
    jobs?: { limitsFor?: (spaceId: number) => Promise<Record<string, unknown> | undefined> };
    /** `ctx.oauth`: where providers send a visitor back — see `FunctionsConfig` in `@plitzi/sdk-actions/functions`. */
    oauth?: { callbackOrigin?: string };
  };
  /** Realtime channels the spaces declare — see {@link SSRRealtimeConfig}. On, in memory, when absent. */
  realtime?: SSRRealtimeConfig;
  /** Connector manifest and credential lookups — see {@link ConnectorLookupsConfig}. They serve the RSC read path
   *  and the `/_action` write endpoint alike; without them neither can reach a connector. */
  connectors?: ConnectorLookupsConfig;
};

/** The actions engine's configuration: the server's, and the engine's own. */
export type EngineConfig = ServerBaseConfig & EngineOptions;

/** The engine's configuration where it answers for a space's host: the adapters that read a space are required. */
export type EngineServerConfig = EngineConfig & { adapters: SSRPageAdapters };

/**
 * How the server reaches a space's actions, and what it may run.
 *
 * Typed loosely for the same reason `ConnectorLookupsConfig` is — the document is executed by
 * `@plitzi/sdk-server`'s actions module and the shared types stay free of its internals. Shaped as `ActionLookups`
 * there.
 */
export type ActionLookupsConfig = {
  getAction: (spaceId: number, actionId: string, at?: SpaceRevision) => Promise<unknown>;
  listActions?: (spaceId: number, at?: SpaceRevision) => Promise<unknown[]>;
  /** Which spaces have something scheduled — the periodic reconcile's safety net. See `ActionLookups`. */
  listScheduledSpaces?: () => Promise<number[]>;
  getCredential?: (spaceId: number, identifier: string) => Promise<Record<string, string> | undefined>;
  getConnector?: (spaceId: number, connectorId: string, at?: SpaceRevision) => Promise<unknown>;
  /** The space's own functions as of that revision — `SpaceFunctions` in `@plitzi/sdk-actions/functions`. */
  getFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<unknown>;
  /** The server halves of the plugins the space uses, by plugin type — a `SpaceFunctions` each. */
  getPluginFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<unknown>;
  /**
   * The space's own data as of that revision — what a project keeps in `src/data/`, kept privately and frozen with each
   * publish — as its files' text by path (`products.json`). A provider resolved on the server whose `query` is
   * `/data/<file>` reads it, and a function's `ctx.data`; no browser is answered it. Given none, `dataDir` is read.
   */
  getData?: (spaceId: number, at?: SpaceRevision) => Promise<unknown>;
  /** The feature flags the space declares as of that revision — what a flow reads as `{{ flags.<name> }}`. */
  getFlags?: (spaceId: number, at?: SpaceRevision) => Promise<Schema['flags']>;
  /**
   * One person of the space by username or id — `{ id, username, name?, avatar? }`, only of someone who belongs to it
   * (its visitors and members, as the deployment knows them): a function's `ctx.visitors.get`. Whatever else is
   * answered is dropped before code sees it. Given none, a server with an `auth` answers its own accounts.
   */
  getVisitor?: (spaceId: number, environment: string, who: string | number) => Promise<unknown>;
};

export type SSRActionConfig = {
  /** URL path for the write endpoint, and the base for the action-addressed routes. Defaults to '/_action'. */
  path?: string;
  /**
   * The origin a page calls its actions on, when it is not the page's own — `https://actions.example.com`: what the
   * pages are told is `origin` + `path`, and they call it with their cookies. Absent, a page calls its own origin, and a
   * gateway sends the path to the worker (the recommended way: one origin, the session and CSRF unchanged).
   *
   * Set, the worker answers the pages of `pageOrigins` alone (CORS with credentials), and it must read the visitor's
   * session: a cookie scoped to a parent domain both share (`authCookie.domain`). It resolves the space with its own
   * `getSpaceDeployment`, which sees this origin's host. A page's `/fn/` routes and channels stay on its own origin.
   */
  origin?: string;
  /**
   * The origins whose pages call the actions on `origin`, exactly as a browser sends them — `https://www.example.com`.
   * Its CORS answers them with credentials and its cross-site check takes them as its own; any other page is refused.
   * Required with `origin`: a worker started without them refuses to start.
   */
  pageOrigins?: string[];
  /**
   * Supplying these is what turns server actions on: without a way to read a document there is nothing to run, and
   * the endpoint keeps answering element-addressed connector writes alone.
   */
  lookups?: ActionLookupsConfig;
  /**
   * Ceilings for every run this server accepts. A space's plan (`limitsFor`) and a document may tighten them, never
   * widen them.
   */
  limits?: ActionLimits;
  /**
   * What one run of that space's actions may spend — its plan's, each at most `limits`; an unset one is `limits`'. Read
   * on every run, so a deployment caches what it answers. Absent, every space gets `limits`.
   */
  limitsFor?: (spaceId: number) => Promise<ActionLimits | undefined>;
  /**
   * Concurrency ceilings.
   *
   * `perSpace`/`perProcess` count CALLS — a click, a webhook, a schedule — where one run is somebody asking for
   * work and one space's callers must not starve another's. A `render` is counted only by `renderPerProcess`,
   * because it arrives because people are reading the page: a ceiling per space there would refuse the five
   * hundredth visitor of a page that is simply doing well.
   *
   * `memoryShare` is the share of this process's memory limit (its container's, else V8's heap limit) past which it
   * takes no new run, of either kind: 0.85 by default. A slot ceiling counts runs, not what they hold, and runs reading
   * large answers can fill a process long before its slots — refusing the next one (`over_capacity`, with a retry) is
   * what keeps the process alive for the runs already in it.
   */
  concurrency?: { perSpace?: number; perProcess?: number; renderPerProcess?: number; memoryShare?: number };
  /** Inbound webhooks are public by construction, so they are counted per caller per minute. Default 60. */
  rateLimit?: { webhookPerMinute?: number };
  /**
   * Database engines a flow may reach, shaped as `ActionDbDriver` in `@plitzi/sdk-actions`.
   *
   * Omitted leaves the `db.query` task unregistered entirely. What a driver connects to is always a database the
   * SPACE declared as a credential — never this deployment's own, which no credential a space holds can name.
   */
  dbDrivers?: unknown[];
  /**
   * The limits on `email.send`, which sends through the SMTP credential a step names, and optionally how a message
   * leaves. Omitted keeps the defaults: 200 messages per space per day, no SMTP host on a private network, and the
   * server's own SMTP connection. See {@link ActionEmailConfig}.
   */
  email?: ActionEmailConfig;
  /**
   * Called once per run that STARTED — completed, failed or aborted — for a deployment that keeps a record.
   * Shaped as `ActionRunRecord` in `@plitzi/sdk-actions`.
   *
   * A refused request is not a run and is not reported here; it goes to {@link SSRActionConfig.onReject}.
   */
  onRun?: (record: ActionRunRecord) => void | Promise<void>;
  /**
   * Called once per request that was REFUSED before it became a run — a webhook whose signature did not verify, a
   * caller over the rate limit, an action nobody may start. Shaped as `ActionRejectRecord`.
   *
   * Its own hook because it answers a different question from `onRun`: runs are history, refusals are a fault
   * report, and the one that matters most — a signature that does not match — is otherwise indistinguishable
   * from the integration simply never firing. Everything is reported; which refusals are worth keeping (a
   * duplicate delivery is a polite retry, not a fault) is the deployment's to decide.
   */
  onReject?: (record: ActionRejectRecord) => void | Promise<void>;
  /**
   * Replaying a finished run's answer to a caller that asks again with the same key, for this many milliseconds.
   *
   * Off unless set, and it only ever applies to a key the CALLER named — an `idempotencyKey` on the call or the
   * delivery id a webhook sender stamps. Single-flight already refuses a retry that arrives while the first run
   * is going; this is for the one that arrives after it finished, which is how every provider retries.
   */
  idempotency?: { replayTtlMs?: number };
  /**
   * What each space's functions sign with (`ctx.sign` / `ctx.verify`): at least 32 characters, the same on every
   * replica. Each space and environment signs with a key derived from it. Absent, spaces sign nothing.
   */
  signingSecret?: string;
  /**
   * Where the `kv` tasks keep things — shaped as `ActionKvAdapter` in `@plitzi/sdk-actions`.
   *
   * Six operations over strings, with no rule to obey: Redis, Memcached, a table, whatever this deployment
   * already runs. How a counter BEHAVES — the key prefixing, the JSON round trip, and the rule that a window's
   * lifetime is set once by whoever created it — belongs to the server, not to the thing it writes into.
   *
   * Omitted leaves an in-process Map, which counts only its own replica. That is fine for one; for a cluster it is
   * a rate limit that multiplies by the number of them, so a multi-replica deployment supplies a shared one.
   */
  kv?: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
    increment: (key: string, amount: number) => Promise<number>;
    expire: (key: string, ttlSeconds: number) => Promise<void>;
    /** Writes `next` only if the key holds `expected` (nothing, when undefined); answers whether it wrote. Atomic. */
    swap: (key: string, expected: string | undefined, next: string, ttlSeconds?: number) => Promise<boolean>;
  };
  /**
   * Scheduled runs: the durable queue they wait in, how many this replica runs at once, and whether it produces.
   *
   * On wherever `lookups.listActions` is answerable — a `schedule` trigger the editor offers is a trigger the
   * server honours, which before this it only did if the deployment wrote a timer and a distributed lock of its
   * own. With no `queue` it runs over this process's memory: right for one replica, and wrong for two, because
   * each then keeps its own schedules and the nightly email goes out once per replica.
   *
   * `false` turns it off for a replica that must only serve pages.
   */
  jobs?: SSRActionJobsConfig | false;
};

/**
 * How this deployment runs what a clock starts.
 *
 * Every default here is a safe one for a single machine; the two a cluster has to think about are `queue` — which
 * must be shared, or the replicas do not see each other's work — and `workers`, which is how fast a backlog
 * drains. Nothing in this config is a clock: the queue's own is the only one the scheduling path reads, so
 * replicas in different countries agree about what has run without agreeing about what time it is.
 */
export type SSRActionJobsConfig = {
  /** Shaped as `JobQueue`. Omitted → this process's memory. */
  queue?: JobQueue;
  /** Jobs this replica runs at once. Default 4; `0` produces without consuming. */
  workers?: number;
  /** Whether this replica sweeps due schedules into the queue. Default true. */
  produce?: boolean;
  /** Whether a space may have scheduled runs — its plan, say: why not, or nothing. Absent, every space may. */
  admitSchedules?: (spaceId: number) => Promise<string | undefined>;
  /** The spaces this server schedules for, when it serves a known few — the self-hosted shape. */
  spaces?: number[];
  /** How often a free worker looks for a job. Default 1s. */
  pollMs?: number;
  /**
   * Which spaces' jobs this replica takes, asked on every claim (`JobSpaces`): a worker kept for some spaces takes
   * theirs alone, the others every space but those. Absent, every space's. Not `spaces`, which is what it schedules.
   */
  claims?: () => JobSpaces | undefined;
  /**
   * What this replica may hold, and the most any of the deployment's may (`JobClaimMemory`), asked on every claim: a
   * job a worker died running then needs more than that one could, runs on a replica that may hold it, and is set aside
   * (`paused`) when none may. Absent, a job whose worker died runs again on whichever claims it.
   */
  claimMemory?: () => JobClaimMemory | undefined;
  /** How often this replica looks for due schedules. Default 15s. */
  schedulePollMs?: number;
  /** How long a claim is held before another replica may take the job over — the failover window. Default 30s. */
  leaseMs?: number;
  /** Attempts a job gets before it is left for an operator as `dead`. Default 3. */
  maxAttempts?: number;
  /** First retry delay, doubling per attempt, up to `maxMs`. Defaults to 30s and 15 minutes. */
  backoff?: { baseMs?: number; maxMs?: number };
  /** Which environment scheduled runs execute in. Default `main`. */
  environment?: Environment;
  /** How often schedules are re-derived from documents. Default 15 minutes. */
  reconcileMs?: number;
  /** Names this replica in the job history. Defaults to the pid and a random suffix. */
  workerId?: string;
  onError?: (error: unknown) => void;
};

/**
 * How the server reaches a space's connectors: the manifest that describes one, and the credential it authenticates
 * with. Shaped as `ConnectorLookups` in `@plitzi/sdk-server`; typed loosely here so the shared types stay free of the
 * server's internals.
 *
 * Top-level, and not under `action`, because BOTH directions need them. Supplying them is what makes the write
 * endpoint able to authorize a write — a write can only be checked against a manifest — and it is also all the server
 * needs to answer a server-driven element's READ, so `adapters.getRscData` is derived from them unless a deployment
 * supplies its own. They lived under `action` when writes were the only caller, which left every deployment building
 * that read half by hand out of `createConnectorResolver` and `resolveRscData` — from these very lookups, passed a
 * second time.
 */
export type ConnectorLookupsConfig = {
  getConnector: (spaceId: number, connectorId: string, at?: SpaceRevision) => Promise<unknown>;
  getCredential?: (spaceId: number, identifier: string) => Promise<Record<string, string> | undefined>;
  fetchImpl?: typeof fetch;
};
