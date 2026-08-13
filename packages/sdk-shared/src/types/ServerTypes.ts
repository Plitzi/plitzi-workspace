import type { Environment } from './CommonTypes';
import type { ConnectorEntry } from './ConnectorTypes';
import type { Schema } from './SchemaTypes';
import type { AnalyticsConfig, OfflineDataRaw } from './SdkTypes';
import type { Style } from './StyleTypes';
import type { IncomingHttpHeaders } from 'node:http';
import type { FC } from 'react';

export type ServerEnvironment = 'development' | 'production' | 'staging' | 'local';

export type SSRHeaders = IncomingHttpHeaders & {
  ':authority'?: string;
  ':method'?: string;
  ':path'?: string;
  ':scheme'?: string;
};

export type SSRRequest = {
  method: string;
  path: string;
  search: string;
  url: string;
  hostname: string;
  protocol: 'http' | 'https';
  headers: SSRHeaders;
  query: Record<string, string>;
  /** Raw request body. Populated only for endpoints that consume it (e.g. the login/logout handlers). */
  body?: string;
  ctx: SSRContext;
};

export type SSRResponseHelpers = {
  status: number;
  /** Multi-valued for the headers that genuinely are, `Set-Cookie` above all — see `setHeader`. */
  headers: Record<string, string | string[]>;
  /** An array sets the header once per entry, which `Set-Cookie` needs: a response that grants a session writes
   *  several, and collapsing them into one string would produce a single malformed cookie. */
  setHeader: (name: string, value: string | string[]) => void;
  setStatus: (code: number) => void;
  send: (body: string) => void;
  write: (chunk: string | Buffer) => void;
  end: () => void;
};

// Mutable channel written during the React SSR render and read back by the server to shape the HTTP
// response (status, redirect, extra headers). Passed by reference as a prop so it crosses the
// server/SDK bundle boundary without relying on a shared React context instance.
export type SSRRenderResult = {
  status?: number;
  redirect?: string;
  headers?: Record<string, string>;
};

export type SSRCredential = {
  provider: string;
  data: unknown;
};

export type PluginAction = 'copy' | 'compile' | 'download';

export type PluginSourceFile<T = Record<string, unknown>> = {
  js: string;
  css?: string;
  action?: PluginAction;
  version?: string;
  props?: T;
};

export type PluginSourceComponent<T = Record<string, unknown>> = {
  component: unknown;
  js?: string;
  css?: string;
  version?: string;
  props?: T;
};

export type PluginSource<T = Record<string, unknown>> = PluginSourceFile<T> | PluginSourceComponent<T>;

export type PluginEntry = {
  name: string;
  /** JS-safe identifier for the import statement (hyphens/dots replaced with underscores, no @version). */
  varName: string;
  /** SDK lookup key used as the object property (base name without @version). */
  keyName: string;
  /** Browser-facing URL served by the SSR server (e.g. /sdk-plugins/name@ver/index.js). */
  js?: string;
  /** Absolute filesystem path used for server-side dynamic import() during SSR. */
  filePath?: string;
  css?: string;
  props: Record<string, unknown>;
};

export type SSRTemplateProps = {
  title?: string;
  jsPath?: string;
  cssPath?: string;
  builderJsPath?: string;
  builderCssPath?: string;
  plugins?: PluginEntry[];
  react?: string;
  reactJsx?: string;
  reactDom?: string;
  reactDomClient?: string;
  reactCompilerRuntime?: string;
  /** When true the client-side <script> block is omitted — useful for inspecting raw SSR HTML. */
  ssrOnly?: boolean;
  debugMode?: boolean;
};

export type SSRPlugin = {
  component: FC;
  props: Record<string, unknown>;
};

/** What a space token is worth. `render` is the public credential every published site embeds — it is readable
 *  by anyone who views the page, so it may only read. `agent` is the delegated grant an MCP connector receives
 *  after a member consents, and is the only bearer that may write without a session behind it. */
export type SpaceScope = 'render' | 'agent';

/** A resolved space token: which space, what the bearer may do, and (for `agent`) the member who consented.
 *  `canWrite` is computed by the consumer from its own authorization model — the MCP never derives it. */
export type SSRGrant = {
  spaceId: number;
  scope: SpaceScope;
  userId?: number;
  canWrite: boolean;
};

/**
 * A session, as the thing that issued it describes it. Deliberately free of transport: whoever mints one says what
 * the credentials are and when they die, and the server decides how they are carried — which is what lets a
 * deployment bring its own identity source without also reimplementing cookies.
 */
export type SSRSession = {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
};

/**
 * How this deployment's session cookies are named and scoped. Every field has a working default derived from the
 * request host, so a server that says nothing still gets a correct cookie; the function forms exist for deployments
 * whose naming varies by environment or host, which is a policy only they know.
 */
export type SSRAuthCookie = {
  name?: string | ((hostname: string) => string);
  /** Return undefined for a host-only cookie. Defaults to the registrable domain, so sibling sub-domains share it. */
  domain?: string | ((hostname: string) => string | undefined);
  sameSite?: 'lax' | 'none';
  secure?: boolean;
  /** Path the refresh credential is confined to, so it never rides along on ordinary traffic. Defaults to `/auth`. */
  refreshPath?: string;
  /** Suffix of the readable companion cookie that carries only expiries. Defaults to `_hint`. */
  hintSuffix?: string;
};

export type SSRUser = {
  token: string; // e.g. JWT or opaque token from auth provider
  /** Unix seconds the token dies at, so the rendered page can renew ahead of it rather than on a refusal. */
  expiresAt?: number;
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

export type SSRSpaceDeployment = {
  /** Who may put this space in an iframe, as CSP `frame-ancestors` sources (e.g. `'self'`, `https://acme.com`,
   *  or `*`). Resolved per space by the consumer, because only it knows the domains that space declares — a
   *  published space must not be framable from a site its owner never allowed. Omitted → the server's own
   *  `frameOptions` default stands. */
  frameAncestors?: string[];
  environment?: Environment;
  credential?: SSRCredential;
  spaceId?: number | null;
  revision?: number;
  templateProps?: SSRTemplateProps;
  pluginNames?: string[];
  pluginSources?: Record<string, PluginSource>;
  error?: {
    code: number;
    message: string;
  };
};

export type SSRTemplateFn = (params: SSRTemplateProps & { html: string; offlineData: string }) => string;

export type SSRRscData = {
  /** Per-element server data keyed by schema element ID. Each element reads its own slice via its id prop. */
  serverData?: Record<string, unknown>;
};

/** Semantic + machine-readable metadata for one element type, so the MCP can tell an agent what the type DOES
 *  (not just that it exists) AND validate against it. `category` groups it (e.g. provider, structure, media);
 *  `custom` marks a plugin-provided type. The MCP keys strict-vs-lenient validation off `custom`: a `custom:false`
 *  (default sdk-elements) type is authoritative — an unknown attribute/setState key on it is an error — while a
 *  `custom:true` (plugin) type is best-effort (warnings only), since its metadata is a manifest snapshot. */
export type ComponentCatalogEntry = {
  label?: string;
  description?: string;
  category?: string;
  custom?: boolean;
  /** The type's attribute/prop keys — the authoritative set for a default type (setState `key` when
   *  category="attribute", and type-prop validation). Absent when unknown (e.g. a plugin with no manifest). */
  attributes?: string[];
  /** The type's `definition.styleSelectors` keys (slots) — setState `key` when category="state" is
   *  `visibility` or `styleSelectors.<selector>`. */
  styleSelectors?: string[];
  /** The type's intrinsic base default CSS (its `defaultStyle.style.base.default`) — the declarations the element
   *  renders with before any class is attached, e.g. `text` defaults to `{ display: 'inline' }`. The MCP surfaces
   *  it so an agent styles against the real starting point instead of assuming `display: block`. */
  defaultStyle?: Record<string, string>;
  /** Binding targets the type exposes, from the plugin manifest's `defaultStyle.bindingsAllowed`. */
  bindingsAllowed?: { attributes?: string[]; initialState?: string[] };
};

/** Element type → its semantic metadata, keyed by the `type` string used in the schema. Covers BOTH the default
 *  sdk-elements types (custom:false, authoritative) and the plugin (custom:true) element types installed on a
 *  space, so the MCP can validate types/attributes dynamically per space instead of against a hand-mirror. */
export type ComponentCatalog = Record<string, ComponentCatalogEntry>;

export type SSRAdapters = {
  /** The space's render payload. Optional HERE and required by a page server (see {@link SSRPageAdapters}): a
   *  dedicated MCP server renders nothing, reads schema and style through its own adapters, and had to hand this
   *  one over anyway for the type to be satisfied — an adapter it never called. */
  getOfflineData?: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  /** Which space, environment and revision a request resolves to. Optional here for the same reason as
   *  `getOfflineData`: MCP resolves its space from the request token (`getGrant`), never from the host. */
  getSpaceDeployment?: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  /** Persist a space mutated by the mcp-ai `apply` tool. Implementations must recompute derived caches
   *  (notably `style.cache`) before storing. When omitted, mcp-ai runs read/preview/validate only and
   *  `apply` reports `persisted: false`. */
  saveOfflineData?: (spaceId: number, environment: string, data: OfflineDataRaw) => Promise<void>;
  /** Resolve the grant the MCP request operates under, from the verified `Authorization` bearer. The consumer
   *  owns the JWT secret and the authorization model, so it decides here; the MCP service stays stateless.
   *  Returns undefined when the token is missing or invalid. Required for the `mcp` service to serve any
   *  request. `canWrite` is what separates a read-only bearer from one that may change the space — the MCP
   *  refuses every write tool without it, and never infers the answer from the token itself. */
  getGrant?: (req: SSRRequest) => Promise<SSRGrant | undefined>;
  /** Read the element schema for the MCP tools. Separate from `getOfflineData` (which is SSR/RSC shaped and
   *  strips `style.platform`); the MCP style resource needs the full documents, so schema and style split. */
  getSchema?: (spaceId: number, environment: Environment) => Promise<Schema | undefined>;
  /** Read the full style document (with `platform`/`mode`, which the MCP definitions resource requires). */
  getStyle?: (spaceId: number, environment: Environment) => Promise<Style | undefined>;
  /** Read the semantic catalog of the space's PLUGIN (custom) element types — label/description/category from
   *  each installed plugin's manifest — so the MCP `plitzi://types` resource can explain what custom elements do.
   *  The MCP already knows the built-in types. When omitted, custom types surface with their observed label only. */
  getComponentCatalog?: (spaceId: number, environment: Environment) => Promise<ComponentCatalog | undefined>;
  /** Read every connector configured for the space, so the MCP can list them and author provider elements against
   *  them. Connectors are space-level (not per environment) server-side state: the manifests name endpoints and an
   *  auth scheme, so this must never feed a browser payload. When omitted, the MCP's connector resource is empty
   *  and a provider element cannot be checked against the connector it names. */
  getConnectors?: (spaceId: number) => Promise<ConnectorEntry[] | undefined>;
  /** Create or replace one connector, keyed by `entry.id`. When omitted, connector ops apply in memory only and
   *  `apply` reports `persisted: false`. */
  saveConnector?: (spaceId: number, entry: ConnectorEntry) => Promise<void>;
  /** Remove one connector by its identifier. Omitted alongside `saveConnector` for a read-only deployment. */
  deleteConnector?: (spaceId: number, connectorId: string) => Promise<void>;
  /** Persist the element schema mutated by the MCP `apply` tool. When omitted, `apply` reports `persisted: false`. */
  saveSchema?: (spaceId: number, environment: Environment, schema: Schema) => Promise<void>;
  /** Persist the style document mutated by the MCP `apply` tool. Implementations must recompute `style.cache`
   *  before storing. When omitted, `apply` reports `persisted: false`. */
  saveStyle?: (spaceId: number, environment: Environment, style: Style) => Promise<void>;
  /** Who this request carries, if anyone. The adapter reads the credential and resolves it; the cookie it arrived
   *  in was written by the server, from {@link SSRAuthCookie}. */
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  /**
   * Verify credentials and mint a session — identity, and nothing else. The server writes the cookies, clears them,
   * and keeps the readable hint in step, because those are properties of how sessions travel rather than of who
   * anyone is. A deployment bringing its own user database implements this and gets the rest for free.
   *
   * Return undefined to refuse. Never throw for a wrong password.
   */
  authenticate?: (credentials: Record<string, string>, req: SSRRequest) => Promise<SSRSession | undefined>;
  /** Revoke whatever session this request carries, at the source. The cookies are the server's to clear. */
  endSession?: (req: SSRRequest) => Promise<void>;
  /**
   * Turn a credential the browser obtained from an identity provider into a session here — see the exchange stage.
   * Everything that decides whether it is any good lives in this adapter, because only the deployment knows:
   *
   * - which providers it trusts, and which one the space in question actually signs people in with;
   * - that the token was minted for **this** application. Anyone who has signed into any other site with the same
   *   provider holds a valid token for that user, so accepting one merely because the provider recognises it lets
   *   that site sign in here as them. A provider that cannot prove it must be refused outright.
   */
  exchangeCredential?: (
    provider: string,
    token: string,
    req: SSRRequest
  ) => Promise<
    { ok: true; session: SSRSession; user?: SSRUser } | { ok: false; error: string; status?: number; reason?: string }
  >;
  /** Called by the RSC endpoint, and once per page render, to fetch server-side data for server components.
   *  See {@link SSRRscContext} for what it is given. */
  getRscData?: (context: SSRRscContext) => Promise<SSRRscData>;
  /**
   * One billable server request. This is where a deployment meters usage, because these are the moments it
   * actually spends bandwidth on a visitor and the ones a visitor cannot reach around: the browser is told
   * what happened, never asked. Each runs before its cache is consulted, so a cached response still counts.
   *
   * What comes back shapes the response — degrade the free tier, hand the browser its reporting channel — and
   * a deployment that meters nothing simply omits the adapter. Never throw from here: a metering outage must
   * not take a site down, so failures should degrade to "served, uncounted".
   */
  meter?: (event: SSRMeterEvent) => Promise<SSRMeterDecision | undefined>;
};

/**
 * Which area of server work is being metered. One name per area, because that is the unit a deployment prices
 * — a full page render does not cost what a partial data refresh costs, and both are cheaper when a cache
 * answered them than when the origin did.
 */
export type MeteredKind =
  | 'page_view'
  | 'rsc_query'
  /** Reserved: nothing emits this yet. Server actions are not implemented — the area exists so wiring them
   *  later is a call site, not a schema change. */
  | 'server_action';

/** The request being metered, for {@link SSRAdapters.meter}. */
export interface SSRMeterEvent {
  kind: MeteredKind;
  /**
   * Whether a cache answered this instead of the origin. Reported rather than inferred: only the handler knows,
   * it is the same fact the response puts on the wire as `X-Cache: HIT`, and what it is worth is the
   * deployment's to decide — an area may price a hit lower, or not distinguish one at all.
   */
  cached: boolean;
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  revision: number;
}

/** What the deployment decided about this request. */
export type SSRMeterDecision = {
  /** This space is over the quota its plan allows and the render should say so — the "Made with Plitzi" badge
   *  on the free tier. Paid plans accrue overage instead and never set this. */
  degrade?: boolean;
  /** Client reporting channel, injected into the page bootstrap. Omitted → the page reports nothing. Only a
   *  page render has anywhere to put it; the other kinds answer data, not a document. */
  analytics?: AnalyticsConfig;
};

/** What a server that RENDERS PAGES must answer: the two adapters every page request goes through, on top of the
 *  optional rest. Stated as its own type rather than by making them required for everyone, because "required" is
 *  a property of the surface being served and not of the adapter set — a dedicated MCP server has no page request
 *  to resolve, and the old shape made it hand over two adapters nothing would ever call. */
export type SSRPageAdapters = SSRAdapters & Required<Pick<SSRAdapters, 'getOfflineData' | 'getSpaceDeployment'>>;

/**
 * Everything an RSC read is given: which space and revision, who is asking, and which elements want data.
 *
 * One object rather than six positional parameters, because the reason to add to it is exactly the reason the
 * positional form failed — `loadOfflineData` is a seventh thing to know, and nobody should have to count commas to
 * reach it, nor rewrite their adapter when an eighth arrives.
 */
export interface SSRRscContext {
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  revision: number;
  /** Whoever the request carries, already resolved. */
  user?: SSRUser;
  /** On a partial refresh, the only element ids that want data. Absent means every one — the initial render. */
  ids?: string[];
  /**
   * The space itself, read at most once per request however many times this is called.
   *
   * It is here because an adapter almost always needs the schema (to know which elements are server-rendered, or
   * whether RSC is on at all) and the server is already loading it for the page — in parallel with this very call.
   * Without a shared handle every deployment fetched it a second time, or wrote its own in-flight dedup to avoid
   * doing so. Awaiting this joins the read already under way; it never starts a second one.
   */
  loadOfflineData: () => Promise<OfflineDataRaw | undefined>;
}

export type SSRActionConfig = {
  /** URL path for the write endpoint. Defaults to '/_action'. */
  path?: string;
  /** Connector manifest and credential lookups. Without them the endpoint stays inert: a write can only be
   *  authorized against a manifest, and there is nothing to authorize against. Shaped as `ConnectorLookups`
   *  in `@plitzi/sdk-server`; typed loosely here so the shared types stay free of the server's internals. */
  lookups?: {
    getConnector: (spaceId: number, connectorId: string) => Promise<unknown>;
    getCredential?: (spaceId: number, identifier: string) => Promise<Record<string, string> | undefined>;
    fetchImpl?: typeof fetch;
  };
};

export type SSRHealthConfig = {
  path?: string;
  /** Replaces the identity payload entirely. `check` still merges over it. */
  payload?: Record<string, unknown>;
  name?: string;
  version?: string;
  role?: string;
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
  /** Brotli quality, 0–11. Default 4 — past that the CPU cost outgrows the bytes saved on HTML. */
  brotliQuality?: number;
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
};

/** What every log event carries, whatever layer it came from. */
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

/** Everything a Plitzi server reports about the work it does, as ONE stream: the HTTP requests it answers, plus
 *  the MCP tool calls and resource reads that happen inside them. Wire a single sink via `SSRServerConfig.logger`
 *  and switch on `kind` — a consumer can render it, ship it to a dashboard or drop the kinds it does not want.
 *
 *  Payload-free by construction: no headers, cookies, tokens nor request body ever reach an event, query values
 *  are stripped from paths and tool arguments are reduced to their shape. Two fields are NOT anonymous and a
 *  consumer shipping these events must handle them accordingly: `clientIp` on a request event, and the request
 *  path, which is kept verbatim because it is what makes the log usable. */
export type ServerLogEvent = ServerRequestLogEvent | McpToolLogEvent | McpResourceLogEvent;

/** The sink a consumer provides to receive every {@link ServerLogEvent} (see `SSRServerConfig.logger`). */
export type ServerLogger = (event: ServerLogEvent) => void;

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
  publicDir?: string;
  static?: Record<string, string>;
  devMode?: boolean;
  /** Authorizes debugging on the pages this server renders. An SSR page loads the very same SDK, so this is the
   *  server-side face of the SDK's `debugMode` prop: the page decides, and the visitor's 'plitzi_debug' cookie can
   *  only narrow it. Defaults to `devMode`, so a development server debugs without being told to. */
  debugMode?: boolean;
  cacheTtlMs?: number;
  loginPath?: string | false;
  middlewares?: SSRMiddleware[];
  logoutPath?: string | false;
  /** Where a browser-obtained credential is handed over. Defaults to `/auth/exchange`; served only when the
   *  `exchangeCredential` adapter is supplied. */
  exchangePath?: string | false;
  /** Naming and scope of the session cookies this server writes. See {@link SSRAuthCookie}. */
  authCookie?: SSRAuthCookie;
  templateFn?: SSRTemplateFn;
  plugins?: Record<string, PluginSource>;
  pluginsCacheDir?: string;
  pluginsTtlMs?: number;
  /** Auto-download and cache plugins declared in the schema's offlineData.plugins list. Default: true. */
  autoLoadSchemaPlugins?: boolean;
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
  /** Receives a {@link ServerLogEvent} for every HTTP request this server answers — whatever stage answered it
   *  and whatever the outcome — plus every MCP tool call and resource read inside those requests. Without it the
   *  server reports nothing per request (the MCP events still reach the console when `MCP_DEBUG=1`). */
  logger?: ServerLogger;
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
export type SSRPageServerConfig = SSRServerConfig & { adapters: SSRPageAdapters };

/** Which surfaces a page server mounts. Only what the page pipeline itself owns: the MCP endpoint and
 *  draft-preview are stages a companion package hands in, so they are not flags here. */
export type ServerServices = {
  ssr?: boolean;
  rsc?: boolean;
};

export type PluginRegistry = {
  register: (name: string, source: PluginSource) => void;
  invalidate: (name?: string, version?: string) => Promise<void>;
};

export type CacheFilter = {
  spaceId?: number;
  environment?: string;
  hostname?: string;
};

export type CacheManager = {
  invalidate: (filter?: CacheFilter) => number;
  clear: () => void;
  readonly size: number;
};

export type SSRMiddlewareNext = () => Promise<void> | void;

export type SSRMiddleware = (req: SSRRequest, res: SSRResponseHelpers, next: SSRMiddlewareNext) => Promise<void> | void;

export type SSRContext = {
  spaceDeployment?: SSRSpaceDeployment;
  user?: SSRUser;
  /** What {@link SSRAdapters.meter} answered for this request, so the render reads the decision instead of
   *  asking for it a second time. */
  meter?: SSRMeterDecision;
};

export type SSRServer = {
  listen: (port: number, host?: string) => void;
  close: () => Promise<void>;
  readonly cache: CacheManager | null;
  readonly plugins: PluginRegistry;
};

/** A key/value store with per-entry expiry, backing the OAuth layer's short-lived protocol state (registered
 *  clients, authorization codes, refresh grants). Values are opaque strings the SDK serialises itself. A
 *  multi-replica deployment MUST inject a shared implementation — a code minted on one replica is redeemed on
 *  whichever replica the token request lands on. */
export type OAuthStore = {
  put: (key: string, value: string, ttlSeconds: number) => void | Promise<void>;
  get: (key: string) => (string | undefined) | Promise<string | undefined>;
  drop: (key: string) => void | Promise<void>;
};

/** Someone who got through {@link OAuthAdapters.authenticate}. `id` is what the other adapters key off; `label`
 *  is shown back on the consent screen so the user can see who they are about to grant access as. */
export type OAuthUser = {
  id: string;
  label: string;
};

/** One thing the user may grant the client access to — a Plitzi space, or whatever else a deployment scopes its
 *  tokens by. `value` is the opaque handle the SDK round-trips back to {@link OAuthAdapters.issueToken}; only the
 *  consumer interprets it. A deployment whose public surface is useful on its own (plitzi_render needs no space)
 *  can offer a target that grants nothing, so the user is never forced to pick one. */
export type OAuthGrantTarget = {
  value: string;
  label: string;
  description?: string;
};

/** What the OAuth layer cannot resolve on its own: who the user is, what they may grant, and the bearer to mint
 *  for them. The SDK owns the protocol (discovery, registration, PKCE, code exchange); the consumer owns identity
 *  and issues a token its own `adapters.getGrant` will accept back. */
export type OAuthAdapters = {
  /** Verify the credentials typed into the consent screen. Return undefined to re-show the form with an error —
   *  never throw for a wrong password. */
  authenticate: (credentials: { username: string; password: string }) => Promise<OAuthUser | undefined>;
  /** What this user may grant access to. An empty list ends the flow with `access_denied`. */
  grantTargets: (user: OAuthUser) => Promise<OAuthGrantTarget[]>;
  /** Mint the bearer the client will send on every MCP request. Return undefined to deny the grant. */
  issueToken: (
    user: OAuthUser,
    target: OAuthGrantTarget
  ) => Promise<{ token: string; expiresInSeconds?: number } | undefined>;
  store: OAuthStore;
};

/** A connection a visitor may take WITHOUT signing in, for a server whose public surface needs no identity — the
 *  MCP App, the tool and resource listings, the guide. The consent screen offers it as a second button beside the
 *  sign-in, and the grant is whatever `target` grants: point it at a target that carries no space, never at one
 *  that does, since nobody proved who they are. */
export type OAuthGuestConfig = {
  /** Handed straight to {@link OAuthAdapters.issueToken} when a visitor takes the guest connection. */
  target: OAuthGrantTarget;
  /** Button text. Defaults to 'Continue without an account'. */
  label?: string;
  /** Who the grant is issued as. Defaults to `{ id: 'guest', label: 'Guest' }`. */
  user?: OAuthUser;
};

/** What the built-in consent screen shows around the form. Ignored when `renderConsent` replaces the page. */
export type OAuthBranding = {
  /** Shown as the heading, e.g. 'Plitzi'. Defaults to 'Plitzi'. */
  productName?: string;
  /** Absolute or same-origin URL of a logo to show above the heading. */
  logoUrl?: string;
  /** Extra CSS appended to the page's own, for a deployment that wants its own look without replacing the page. */
  css?: string;
};

/** Everything the consent screen needs to render itself, for a deployment that replaces the built-in page. Return
 *  a full HTML document; the SDK serves it as-is and reads the same form fields back. */
export type OAuthConsentView = {
  /** 'credentials' asks for username + password; 'target' asks which space to grant, after a successful login. */
  step: 'credentials' | 'target';
  /** Where the form must POST to (the authorize endpoint). */
  action: string;
  /** Hidden fields the form MUST round-trip verbatim, or the flow cannot be resumed. */
  hidden: Record<string, string>;
  /** Offered on the 'target' step only. */
  targets: OAuthGrantTarget[];
  /** Offered on the 'credentials' step when the deployment allows a guest connection. The form must submit a
   *  `guest` field for it (any non-empty value), which is what tells the server to skip authentication. */
  guest?: { label: string; description?: string };
  /** Who logged in, on the 'target' step. */
  user?: OAuthUser;
  /** A message to show the user, e.g. after a failed login. */
  error?: string;
  branding: OAuthBranding;
};

/** OAuth 2.1 authorization for the MCP server (RFC 9728 discovery + RFC 7591 dynamic client registration +
 *  authorization code with PKCE). ENTIRELY OPTIONAL: without this config no endpoint is mounted, discovery keeps
 *  answering 404 and the server stays anonymous, which is a working setup — the public surface (handshake, tool
 *  and resource listing, the guide, plitzi_render) never needed a token. Configure it only to let a remote host
 *  that cannot send custom headers — Claude Desktop, ChatGPT — obtain a space-scoped one.
 *
 *  Configuring it also protects the MCP endpoint: a JSON-RPC call that presents no verifiable bearer is answered
 *  with RFC 6750's 401 challenge rather than the anonymous surface, because that 401 is the only thing a host runs
 *  its flow off — it ignores a `WWW-Authenticate` header on a 200, and a server that never sends one is treated as
 *  needing no authorization at all, leaving a completed grant with nowhere to attach. Offer a grant target that
 *  carries no space ({@link OAuthGrantTarget}) so the public surface stays one consent away. */
export type OAuthConfig = {
  adapters: OAuthAdapters;
  /** The issuer/resource identifier published in the metadata documents. Defaults to the origin the request came
   *  in on, which is correct whenever the server owns its sub-domain; set it when a proxy rewrites the host. */
  issuer?: string;
  /** Scope names advertised and echoed back on the token. Defaults to ['plitzi']. */
  scopes?: string[];
  /** How long an authorization code stays redeemable, in seconds. Default 60 — codes are one-shot and redeemed
   *  immediately. */
  codeTtlSeconds?: number;
  /** How long a refresh grant lives, in seconds. Default 30 days. Set 0 to issue no refresh tokens. */
  refreshTtlSeconds?: number;
  /** Offer a connection that needs no account — see {@link OAuthGuestConfig}. Omit to require sign-in. */
  guest?: OAuthGuestConfig;
  branding?: OAuthBranding;
  /** Replaces the built-in consent screen — return a full HTML document for the given step. */
  renderConsent?: (view: OAuthConsentView) => string | Promise<string>;
};

/** A short-TTL, one-shot store for unsaved draft offline-data behind a preview token. The SDK ships an
 *  in-memory default (fine for a single replica); a multi-replica deployment injects a shared (e.g. Redis)
 *  implementation so a preview URL resolves on whichever replica the browser lands on. `take` consumes the
 *  token so a preview URL is not replayable. */
export type DraftStore = {
  put: (token: string, data: OfflineDataRaw, ttlMs: number) => void | Promise<void>;
  take: (token: string) => (OfflineDataRaw | undefined) | Promise<OfflineDataRaw | undefined>;
};

/** Draft-preview config for the MCP visual-preview tools. When enabled, an internal endpoint at `path`
 *  (guarded by `secret`) applies unsaved edits to a clone, stashes the resulting offline-data under a
 *  one-shot token, and the render path serves it back at `?__pt=<token>`. Off by default. */
export type SSRPreviewConfig = {
  enabled?: boolean;
  /** Internal endpoint path that mints a preview token. Default '/__preview'. */
  path?: string;
  /** Shared secret required in the `x-preview-secret` header; requests without it are rejected. */
  secret?: string;
  /** Token time-to-live in milliseconds. Default 60000. */
  ttlMs?: number;
};
