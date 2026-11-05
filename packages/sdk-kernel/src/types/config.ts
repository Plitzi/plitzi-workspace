import type { SSRAdapters } from './adapters';
import type { LogLevel, ServerLogger } from './log';
import type { SSRMiddleware, ServerEnvironment } from './pipeline';
import type { StatsConfig } from '../stats/types';
import type { ServerFlags } from '@plitzi/sdk-shared/flags';

/**
 * What every Plitzi server process is configured with (RFC 0032, D12): its transport, its log, its health, the headers
 * it answers with, what it may reach, and the adapters it asks. A page server's configuration and the actions engine's
 * are both this and their own.
 */
export type ServerBaseConfig = {
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
  flags?: ServerFlags;
  /** How long a rendered page, its schema data and a basic-auth check are kept, in ms. Default 300 000; `0` keeps none. */
  cacheTtlMs?: number;
  middlewares?: SSRMiddleware[];
  /**
   * What the requests a space's documents write may reach from inside this server. See {@link SSROutboundConfig}.
   */
  outbound?: SSROutboundConfig;
  /** Controls iframe embedding via CSP frame-ancestors (and X-Frame-Options for legacy browsers).
   *  'DENY' — no site may embed this server (default).
   *  'SAMEORIGIN' — only the same origin may embed it.
   *  string[] — explicit list of allowed origins, e.g. ['https://app.example.com', 'https://preview.example.com'].
   *  false — no restriction; headers are omitted. */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string[] | false;
  /**
   * `Strict-Transport-Security` on every response over https: browsers then refuse the site over plain http, and ask it
   * over https from the first request. A year, with every sub-domain, by default; `preload` only once the domain is
   * submitted to the browsers' list. Never on this machine nor on a domain no public CA certifies (`.local`, `.test`,
   * `.localhost`): a browser told so would refuse a development certificate with no way past it. `false` sends none.
   */
  hsts?: false | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  /**
   * `Cross-Origin-Opener-Policy`: a page opened from another site, or that opens one, is put in a browsing context of
   * its own — the other cannot reach it through `window.opener`. `same-origin-allow-popups` by default, which keeps what
   * a page opens (a payment, a sign-in with another provider) able to answer it; `same-origin` isolates those too.
   * `false` sends none.
   */
  crossOriginOpenerPolicy?: false | 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
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
   * How it stops when told to (`close()`, a SIGTERM through `closeOnSignals`): for `announceMs` it keeps serving with
   * `/health` answering 503 — so a load balancer takes it out of rotation before its port closes; 0 by default, 5000
   * behind one — and then what it is answering has `graceMs` to finish before it is cut: 10000 by default, and at least
   * the longest action it runs (a call cut halfway is a run lost). Its orchestrator's own grace (a pod's
   * `terminationGracePeriodSeconds`) is longer than the two together.
   */
  shutdown?: { announceMs?: number; graceMs?: number };
  /**
   * From how many ms a run that worked is said as slow, at `warn`, with its steps; below it a run that worked is `debug`.
   * 1000 by default (`SLOW_RUN_MS`): raise it where the actions are slow on purpose — a report, an import.
   */
  slowRunMs?: number;
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
  /** Liveness/readiness endpoint for standalone servers (k8s probes). A stage always answers `path`
   *  (default /health) with the generic identity payload built from `name`/`version`/`role`
   *  ({ Server, Version, role }); pass an explicit `payload` to override it entirely, or `check` to add what can
   *  only be known per request. See {@link SSRHealthConfig}. */
  health?: SSRHealthConfig;
  /**
   * This process's stats (`GET /_stats`, behind `secret`): its pool and instance, its load, how its work went over the
   * last minute, quarter and hour, and whether that is healthy — what `readPools` reads of every process alike. Absent,
   * it keeps none and answers nothing there.
   */
  stats?: StatsConfig;
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

/**
 * What the requests a space's documents write may reach from inside this server — a server provider's `query`, an
 * action's `http.request`, a connector, a function's `fetch`, a plugin's address.
 *
 * Each is typed by whoever edits a space and sent from a trusted network position, so none reaches a private address
 * (`localhost`, this server's own network, the cloud's metadata) — but the deployment's own storage, CDN or API may sit
 * on that network, put there by whoever runs it. Those origins are named here, and only they are reached.
 */
export type SSROutboundConfig = {
  /**
   * Origins on this server's own network a space's requests may reach: `http://localhost:9000` for a local S3, the
   * cluster's `http://api.internal` — an origin (`scheme://host:port`), no path. Everything else private stays closed.
   */
  privateOrigins?: string[];
};
