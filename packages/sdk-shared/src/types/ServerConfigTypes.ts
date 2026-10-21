import type { ActionEmailConfig, ActionLimits, ActionRejectRecord, ActionRunRecord } from './ActionTypes';
import type { Environment, ServerAuth } from './CommonTypes';
import type { JobQueue } from './JobTypes';
import type { DraftStore, SSRPreviewConfig } from './PreviewTypes';
import type { SSRRealtimeConfig } from './RealtimeTypes';
import type { Schema } from './SchemaTypes';
import type { SSRAdapters, SSRPageAdapters, SpaceRevision } from './ServerAdapterTypes';
import type { LogLevel, ServerLogger } from './ServerLogTypes';
import type {
  PluginSource,
  SSRAuthCookie,
  SSRFontsConfig,
  SSRImagesConfig,
  SSRMiddleware,
  SSRTemplateFn,
  ServerEnvironment,
  ServerServices
} from './ServerTypes';

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
  /** The space's own functions as of that revision — `SpaceFunctions` in `@plitzi/sdk-server/functions`. */
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
};

export type SSRActionConfig = {
  /** URL path for the write endpoint, and the base for the action-addressed routes. Defaults to '/_action'. */
  path?: string;
  /**
   * Supplying these is what turns server actions on: without a way to read a document there is nothing to run, and
   * the endpoint keeps answering element-addressed connector writes alone.
   */
  lookups?: ActionLookupsConfig;
  /** Ceilings for every run this server accepts. A document may tighten them, never widen them. */
  limits?: ActionLimits;
  /**
   * Concurrency ceilings.
   *
   * `perSpace`/`perProcess` count CALLS — a click, a webhook, a schedule — where one run is somebody asking for
   * work and one space's callers must not starve another's. A `render` is counted only by `renderPerProcess`,
   * because it arrives because people are reading the page: a ceiling per space there would refuse the five
   * hundredth visitor of a page that is simply doing well.
   */
  concurrency?: { perSpace?: number; perProcess?: number; renderPerProcess?: number };
  /** Inbound webhooks are public by construction, so they are counted per caller per minute. Default 60. */
  rateLimit?: { webhookPerMinute?: number };
  /**
   * Database engines a flow may reach, shaped as `ActionDbDriver` in `@plitzi/sdk-server/actions`.
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
   * Shaped as `ActionRunRecord` in `@plitzi/sdk-server/actions`.
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
   * Where the `kv` tasks keep things — shaped as `ActionKvAdapter` in `@plitzi/sdk-server/actions`.
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
  /** The spaces this server schedules for, when it serves a known few — the self-hosted shape. */
  spaces?: number[];
  /** How often a free worker looks for a job. Default 1s. */
  pollMs?: number;
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

export type SSRHealthConfig = {
  path?: string;
  /** Replaces the identity payload entirely. `check` still merges over it. */
  payload?: Record<string, unknown>;
  name?: string;
  version?: string;
  role?: string;
  /**
   * Which of the servers that answer with this name this one is — a project's copy in another folder, a replica —
   * answered as `Instance`: a tool reaching a port tells the server it meant from another of the same name by it.
   */
  instance?: string;
  /**
   * Live state, read on every probe and merged over the payload — the stores this process depends on, a queue
   * depth, whatever only this deployment can know. Returning `healthy: false` answers **503**, which is what turns
   * the endpoint from a liveness check into a readiness one: an orchestrator stops routing to a replica whose
   * database has gone, instead of sending it traffic it can only fail.
   *
   * A check that throws is itself an unhealthy answer, and is reported as one rather than as a 500.
   */
  check?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
};

/** Response compression. Every field has a default; supply only what this deployment wants different. */
export type SSRCompressionConfig = {
  /**
   * Which encodings this server will use, most preferred first — the first one the client accepts wins. Default
   * `['br', 'gzip']`. `['gzip']` for a client or proxy that mishandles Brotli; `[]` disables compression, same as
   * `compression: false`.
   */
  encodings?: ('br' | 'gzip')[];
  /** Responses smaller than this many bytes go out uncompressed. Default 1024. */
  threshold?: number;
  /**
   * Brotli quality, 0–11, for a body compressed on every request — a page rendered for this request alone. Default 5:
   * the first quality under gzip's size for the CPU gzip spends — 2 came out larger than gzip on a 220 KB page (36 KB
   * against 31; 5: 29). On half a core it costs ~0.1 ms a page, 5–8% of the pages a second of a 6 KB page.
   */
  brotliQuality?: number;
  /**
   * Brotli quality, 0–11, for a body compressed once and kept — a cached page, a static file such as the SDK bundle.
   * Default 6: paid once, and every later response is that much smaller (the SDK bundle 10% under quality 4), for
   * the same memory as 4. 9 needs ~40 MB more to compress the bundle, which a 128 MB server does not have; 10 and
   * 11 cost seconds, which the request that fills the cache would wait for.
   */
  keptBrotliQuality?: number;
  /** Gzip level, 0–9. Default 6. */
  gzipLevel?: number;
};

export type SSRRscConfig = {
  /** Whether the RSC endpoint is active. Defaults to true when adapters.getRscData is provided. */
  enabled?: boolean;
  /** URL path for the RSC endpoint. Defaults to '/_rsc'. */
  path?: string;
  /** Server-side cache TTL for RSC responses in milliseconds. Defaults to 30 000. Set to 0 to disable. */
  cacheTtlMs?: number;
  /**
   * How long ONE server element may take before the page is answered without it. Defaults to 5 000.
   *
   * It is the page's ceiling, and it wins over the producer's own: an action may be allowed ten seconds of its
   * own (`action.limits.timeoutMs`) and still be cut off here, because a section is worth waiting for only as
   * long as the visitor is. Whichever is tighter decides, and now that the budget CANCELS what it stops waiting
   * for, being cut here ends the run rather than leaving it to finish for nobody.
   *
   * Raise it for a deployment whose sections are genuinely slow and worth the wait; lower it to keep a page fast
   * at the cost of showing more empty sections when a provider is having a bad day.
   */
  elementTimeoutMs?: number;
};

export type SSRServerConfig = {
  port?: number;
  host?: string;
  httpVersion?: 1 | 2 | 3;
  tls?: {
    key: Buffer | string;
    cert: Buffer | string;
    minVersion?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';
  };
  environment?: ServerEnvironment;
  /** Served to anyone who asks, as it is: pictures, a favicon, what a page fetches in the browser. */
  publicDir?: string;
  /**
   * The project's own data, never served as files: a provider resolved on the server (`runtime: 'server'`) whose
   * `query` is `/data/<file>` reads `<dataDir>/<file>`, and the page arrives with it. Nobody downloads the folder; what
   * a provider reads goes into the page it renders, though — data a page must not carry is a server action's to read,
   * answering only what is shown: a function reads it with `ctx.data('<file>')`. It is the space's data lookup
   * (`action.lookups.getData`) when the deployment gives none.
   */
  dataDir?: string;
  static?: Record<string, string>;
  devMode?: boolean;
  /**
   * Every page this server renders listens for what changes under it: new documents for the space it shows, swapped
   * where it stands (`updatePages`), or everything loaded again (`reloadPages`) — the edit loop of a project that
   * authors its space in code, a page an agent keeps rewriting (`createAuthoringHost`). Off unless asked for, `devMode`
   * included: each open page holds a connection to the server for it, which a server whose space never changes under
   * it would only pay for.
   */
  livePages?: boolean;
  /** Authorizes debugging on the pages this server renders. An SSR page loads the very same SDK, so this is the
   *  server-side face of the SDK's `debugMode` prop: the page decides, and the visitor's 'plitzi_debug' cookie can
   *  only narrow it. Left unset, `devMode` authorizes it — a development server debugs without being told to — and
   *  so does a space whose settings switched `devTools` on. Set, it decides for every space: `false` is a refusal
   *  no space can turn around. */
  debugMode?: boolean;
  /**
   * The feature flags this deployment decides, by name — the `server` layer: above what each space declares, below
   * the SDK embedding a page and a tester with the dev tools. Only for flags a space declares; an override of one it
   * does not is ignored, and the page says so in its console.
   *
   * A function when one server renders several spaces and they do not share their flags: it is asked per render.
   */
  flags?: Record<string, boolean> | ((space: { spaceId: number; environment: Environment }) => Record<string, boolean>);
  cacheTtlMs?: number;
  loginPath?: string | false;
  middlewares?: SSRMiddleware[];
  logoutPath?: string | false;
  /** Where a browser-obtained credential is handed over. Defaults to `/auth/exchange`; served only when the
   *  `exchangeCredential` adapter is supplied. */
  exchangePath?: string | false;
  /**
   * Signing visitors in by redirect, through an OAuth 2.1 authorization server — see {@link SSRSignInConfig}. Served
   * only with the `exchangeCredential` adapter, which is what turns what comes back into a session on this host.
   */
  signIn?: SSRSignInConfig;
  /**
   * The sign-in this server's pages are told about (`server.auth`), so a space that declares no `userProvider` signs
   * in with nothing to declare. `createServer({ auth })` fills it from the kernel's `basePath`; name it yourself when
   * the `/auth` flows are served by another host. The session hint cookie is added per request, named for the host.
   */
  pageAuth?: Omit<ServerAuth, 'sessionHintCookie'>;
  /** Naming and scope of the session cookies this server writes. See {@link SSRAuthCookie}. */
  authCookie?: SSRAuthCookie;
  templateFn?: SSRTemplateFn;
  plugins?: Record<string, PluginSource>;
  /** Where the plugins it builds are kept. Default: `tmp/.sdk-plugins` under the working directory. */
  pluginsCacheDir?: string;
  pluginsTtlMs?: number;
  /** Auto-download and cache plugins declared in the schema's offlineData.plugins list. Default: true. */
  autoLoadSchemaPlugins?: boolean;
  /**
   * Whether a schema plugin may be read from a private address — `localhost`, the network this server runs in. A
   * plugin's address is typed by whoever edits a space and read from inside this server, so it answers to the rule
   * every authored request does and is refused there; turn this on only on a development machine whose bucket is on
   * localhost. Default: false.
   */
  allowPrivatePluginHosts?: boolean;
  /** Where this deployment serves the font files a space uploaded — see {@link SSRFontsConfig}. */
  fonts?: SSRFontsConfig;
  /** Remote pictures resized by this server — see {@link SSRImagesConfig}. Absent, images keep their own `src`. */
  images?: SSRImagesConfig;
  /** Omit client-side JS from the rendered page — useful for verifying SSR HTML without hydration. Default: false. */
  ssrOnly?: boolean;
  /** Stream HTML to the client as React renders, reducing TTFB. Default: false. */
  streaming?: boolean;
  /** Controls iframe embedding via CSP frame-ancestors (and X-Frame-Options for legacy browsers).
   *  'DENY' — no site may embed this server (default).
   *  'SAMEORIGIN' — only the same origin may embed it.
   *  string[] — explicit list of allowed origins, e.g. ['https://app.example.com', 'https://preview.example.com'].
   *  false — no restriction; headers are omitted. */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string[] | false;
  /** RSC (React Server Components) endpoint configuration. */
  rsc?: SSRRscConfig;
  /** Write endpoint for server-driven providers. Absent means the server serves reads only. */
  action?: SSRActionConfig;
  /**
   * The server's code: its own (`native`), the server halves of the plugins it ships (`plugins`, by plugin type), the
   * runner the spaces' code runs on, and the ceilings. Built by `@plitzi/sdk-server/functions` (`loadFunctions`), and
   * checked as the server starts.
   */
  functions?: {
    native?: unknown[];
    plugins?: Record<string, unknown>;
    runner?: unknown;
    limits?: Record<string, number>;
    /** What the spaces' jobs may spend, per space (its plan): see `FunctionJobLimits` in `@plitzi/sdk-server/functions`. */
    jobs?: { limitsFor?: (spaceId: number) => Promise<Record<string, unknown> | undefined> };
    /** `ctx.oauth`: where providers send a visitor back — see `FunctionsConfig` in `@plitzi/sdk-server/functions`. */
    oauth?: { callbackOrigin?: string };
  };
  /** Realtime channels the spaces declare — see {@link SSRRealtimeConfig}. On, in memory, when absent. */
  realtime?: SSRRealtimeConfig;
  /**
   * The writes a page of another origin may cause here. None, by default: a browser's POST, PUT, PATCH or DELETE that it
   * says a page of another origin caused (`Sec-Fetch-Site` `cross-site` or `same-site` — another port of this host, a
   * sibling sub-domain — or a foreign `Origin`) is refused 403 `reason: 'foreign'` —
   * a session cookie or none, because a server holding credentials of its own, or a tool nobody signs in to, acts for
   * whoever reaches it. A request with `Authorization`, and one that is not a browser's (a webhook, a script), are never
   * asked. With `auth`, the deployment's `identity.platformOrigins` count as its own too.
   */
  crossSiteWrites?: {
    /** Origins whose pages may write here, exactly as a browser sends them — `https://app.example.com`. */
    origins?: string[];
    /** Paths any origin may post to: a form other sites embed by design. */
    paths?: (path: string) => boolean;
  };
  /** Connector manifest and credential lookups — see {@link ConnectorLookupsConfig}. They serve the RSC read path
   *  and the `/_action` write endpoint alike; without them neither can reach a connector. */
  connectors?: ConnectorLookupsConfig;
  /** Receives a {@link ServerLogEvent} for every HTTP request this server answers — whatever stage answered it
   *  and whatever the outcome — plus every MCP tool call and resource read inside those requests. Without it the
   *  server reports nothing per request (the MCP events still reach the console when `MCP_DEBUG=1`). Everything
   *  else the server has to say — a failure, a plugin rebuilt — comes here too as a `message` event, and goes to the
   *  console when there is no logger. */
  logger?: ServerLogger;
  /**
   * The least severe thing worth saying — see {@link LogLevel}. `error` by default, `info` with `devMode`: a server
   * in production reports what went wrong and nothing else, unless asked. A request that was answered is `info`, one
   * that failed `error`; a refused action is `warn`. Below the level nothing is built, so a quiet server pays nothing
   * per request for the log it is not keeping.
   */
  logLevel?: LogLevel | 'silent';
  /**
   * How responses are compressed. Omit for Brotli where the client takes it and gzip otherwise; `false` never
   * compresses, which is what to use when a proxy or CDN in front already does it.
   */
  compression?: SSRCompressionConfig | false;
  /**
   * What to do when the server cannot take its port. Without it the server prints what went wrong, what to do about
   * it, and exits non-zero — because a process whose server never bound is not running, and the alternative is a raw
   * `EADDRINUSE` stack that says nothing about which port or which server.
   *
   * Supply this to keep the process alive and decide for yourself: an embedder that starts several servers, a
   * supervisor that retries, a test that asserts the failure. Handling it here replaces the exit entirely.
   */
  onListenError?: (error: NodeJS.ErrnoException, context: { port: number; host: string; label: string }) => void;
  /**
   * How many processes serve this port. Node runs JavaScript on one thread, so one process renders on one core however
   * many the machine has; each worker is a whole server of its own, and the connections are spread between them —
   * more requests a second, and less time waiting behind another render.
   *
   * `true` / `'auto'`: one per core the process may actually use (a container's CPU quota included). `false`: one
   * process. A number: that many, lowered to the cores there are (more only take turns on the same cores). Default: on
   * under `NODE_ENV=production`, off otherwise — a development server and a test runner stay one process. The
   * `SDK_SERVER_WORKERS` environment variable sets it when this does not.
   *
   * The workers are one server — one replica — and behave as one:
   *
   * - The stores kept in memory by default (an action's `kv`, the job queue, draft previews, the sign-in rate
   *   limit) are the primary's, and each worker reaches them over the cluster channel. A store the deployment
   *   supplies (Redis, a table) is used as it is.
   * - The scheduler and the job consumers run in one worker only, so a schedule fires once and `jobs.workers` is the
   *   whole server's concurrency; if that worker dies, its replacement takes them over.
   * - `server.cache.invalidate()`, `server.plugins.register()` and `server.plugins.invalidate()` reach every worker,
   *   whichever process calls them.
   *
   * Per worker: the rendered-page cache (each renders a page once), the plugin components, and the action run caps
   * (`action.concurrency`: `perSpace`, `perProcess`, `renderPerProcess`), which a cluster of replicas already counts
   * per replica. A plugin registered with a `component` stays in the process that registered it — register those
   * where the server is created.
   */
  workers?: boolean | number | 'auto';
  adapters: SSRAdapters;
  /** Which request-handling services this server mounts: `ssr` on by default, `rsc` whenever
   *  `adapters.getRscData` exists. Stages a companion package contributes are deliberately NOT flags here —
   *  handing them over is the decision. Only createServer reads these as written; the surface factories pin what
   *  their name promises (a page server serves pages; a dedicated MCP server serves MCP alone). */
  services?: ServerServices;
  /** Liveness/readiness endpoint for standalone servers (k8s probes). A stage always answers `path`
   *  (default /health) with the generic identity payload built from `name`/`version`/`role`
   *  ({ Server, Version, role }); pass an explicit `payload` to override it entirely, or `check` to add what can
   *  only be known per request. See {@link SSRHealthConfig}. */
  health?: SSRHealthConfig;
  /** Cache-buster appended as ?v=<assetVersion> to all default SDK asset URLs (jsPath, cssPath, react vendor). Compute from file mtime or package version at startup. */
  assetVersion?: string;

  /** The draft-preview endpoint, and the store behind it. The draft is WRITTEN by an MCP tool and RENDERED here,
   *  so this is the one piece of that feature the page server owns: `@plitzi/sdk-mcp` carries everything else in
   *  its own options, and a deployment that never installs it leaves both unset.
   *
   *  `preview` mounts the endpoint (off unless `enabled`); `draftStore` backs the tokens and defaults to an
   *  in-memory store — inject a shared one (e.g. Redis) for multi-replica correctness. */
  preview?: SSRPreviewConfig;
  draftStore?: DraftStore;
};

/** The same config as seen by a server that serves PAGES: its adapters answer for a page request. This is what
 *  `createServer` from `@plitzi/sdk-server` takes and what the SSR stages are handed, so a page stage reaches
 *  `getOfflineData` without asking whether it is there — while a stage typed to the bare context (anything from
 *  `@plitzi/sdk-mcp`, which also runs in servers that have neither) still has to check. */
/**
 * A visitor signs in somewhere else and comes back signed in HERE: `GET <path>?return=/somewhere` sends them to the
 * authorization server, and `GET <path>/callback` takes the code it answers with, redeems it server to server and
 * hands the token to `exchangeCredential` — which is what makes the session, on this host, for this space.
 *
 * This server registers itself with the authorization server (RFC 7591) as the host the visitor is on, and proves the
 * exchange with PKCE. The state travels in a `__Host-` cookie, which no sibling host can set: a sign-in somebody else
 * started cannot be finished in this browser.
 */
export type SSRSignInConfig = {
  /** What `exchangeCredential` knows the tokens by. */
  provider: string;
  /** Where the visitor's browser is sent: the authorization server's `/authorize`, as the public reaches it. */
  authorizeUrl: string;
  /** Where this server registers itself and redeems codes — reachable from here, which may be a private address. */
  registerUrl: string;
  tokenUrl: string;
  /** What to ask for, for the space being signed into. */
  scope: (spaceId: number) => string;
  /** Where the flow answers. Default `/auth/sign-in`; the authorization server sends people back to `<path>/callback`. */
  path?: string;
};

export type SSRPageServerConfig = SSRServerConfig & { adapters: SSRPageAdapters };
