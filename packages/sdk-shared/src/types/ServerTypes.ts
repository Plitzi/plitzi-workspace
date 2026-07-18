import type { Environment } from './CommonTypes';
import type { McpServerConfig } from './McpTypes';
import type { Schema } from './SchemaTypes';
import type { OfflineDataRaw } from './SdkTypes';
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
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
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

export type SSRUser = {
  token: string; // e.g. JWT or opaque token from auth provider
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

export type SSRSpaceDeployment = {
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
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  /** Persist a space mutated by the mcp-ai `apply` tool. Implementations must recompute derived caches
   *  (notably `style.cache`) before storing. When omitted, mcp-ai runs read/preview/validate only and
   *  `apply` reports `persisted: false`. */
  saveOfflineData?: (spaceId: number, environment: string, data: OfflineDataRaw) => Promise<void>;
  /** Resolve the spaceId the MCP request operates on, from the verified `Authorization` bearer. The consumer
   *  owns the JWT secret, so it decodes here; the MCP service stays stateless. Returns undefined when the
   *  token is missing or invalid. Required for the `mcp` service to serve any request. */
  getSpaceId?: (req: SSRRequest) => Promise<number | undefined>;
  /** Read the element schema for the MCP tools. Separate from `getOfflineData` (which is SSR/RSC shaped and
   *  strips `style.platform`); the MCP style resource needs the full documents, so schema and style split. */
  getSchema?: (spaceId: number, environment: Environment) => Promise<Schema | undefined>;
  /** Read the full style document (with `platform`/`mode`, which the MCP definitions resource requires). */
  getStyle?: (spaceId: number, environment: Environment) => Promise<Style | undefined>;
  /** Read the semantic catalog of the space's PLUGIN (custom) element types — label/description/category from
   *  each installed plugin's manifest — so the MCP `plitzi://types` resource can explain what custom elements do.
   *  The MCP already knows the built-in types. When omitted, custom types surface with their observed label only. */
  getComponentCatalog?: (spaceId: number, environment: Environment) => Promise<ComponentCatalog | undefined>;
  /** Persist the element schema mutated by the MCP `apply` tool. When omitted, `apply` reports `persisted: false`. */
  saveSchema?: (spaceId: number, environment: Environment, schema: Schema) => Promise<void>;
  /** Persist the style document mutated by the MCP `apply` tool. Implementations must recompute `style.cache`
   *  before storing. When omitted, `apply` reports `persisted: false`. */
  saveStyle?: (spaceId: number, environment: Environment, style: Style) => Promise<void>;
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  onLogin?: (req: SSRRequest, res: SSRResponseHelpers) => Promise<boolean>;
  onLogout?: (req: SSRRequest, res: SSRResponseHelpers) => Promise<void>;
  /** Called by the RSC endpoint to fetch server-side data for server components.
   *  When `ids` is provided the adapter should return data only for those element IDs.
   *  Omitting `ids` (initial SSR fetch or full refresh) must return data for all elements. */
  getRscData?: (
    req: SSRRequest,
    spaceId: number,
    environment: Environment,
    revision: number,
    user: SSRUser | undefined,
    ids?: string[]
  ) => Promise<SSRRscData>;
};

export type SSRRscConfig = {
  /** Whether the RSC endpoint is active. Defaults to true when adapters.getRscData is provided. */
  enabled?: boolean;
  /** URL path for the RSC endpoint. Defaults to '/_rsc'. */
  path?: string;
  /** Server-side cache TTL for RSC responses in milliseconds. Defaults to 30 000. Set to 0 to disable. */
  cacheTtlMs?: number;
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
  publicDir?: string;
  static?: Record<string, string>;
  devMode?: boolean;
  cacheTtlMs?: number;
  loginPath?: string | false;
  middlewares?: SSRMiddleware[];
  logoutPath?: string | false;
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
  /** MCP (Model Context Protocol) server configuration — exposes schema tools to Claude. */
  mcp?: McpServerConfig;
  /** AI-native MCP server — replaces the standard MCP with a zero-hallucination batch protocol.
   *  When enabled, requests to the MCP path serve the AI-native server instead. */
  mcpAi?: {
    enabled?: boolean;
    path?: string;
  };
  adapters: SSRAdapters;
  /** Draft-preview endpoint for the MCP visual-preview tools (the RENDERER side). Off unless `enabled`. */
  preview?: SSRPreviewConfig;
  /** For an MCP server that runs separately from the renderer (the CLIENT side): where to reach the SSR
   *  `/preview` endpoint so the visual-preview tools work. The SDK builds an HTTP preview client from this;
   *  absent → those tools report PREVIEW_UNAVAILABLE. */
  previewClient?: { url: string; secret?: string };
  /** Dedicated headless-browser service for plitzi_screenshot (off unless set). `serviceUrl` is the browser
   *  service that turns a URL into PNG(s); `renderBaseUrl` is the SSR base the browser navigates to (a page
   *  path + the one-shot `__pt` token are appended). When absent, plitzi_screenshot is not registered and only
   *  the HTML plitzi_preview is available; when the service is unreachable at call time the tool degrades to
   *  returning the HTML preview with a warning. */
  screenshot?: { serviceUrl: string; renderBaseUrl: string };
  /** Backing store for draft-preview tokens. Defaults to an in-memory store (single replica); inject a shared
   *  store (e.g. Redis) for multi-replica correctness. */
  draftStore?: DraftStore;
  /** Which request-handling services this server mounts. Each maps to an internal `create<Name>Server` unit,
   *  so new services scale without rewriting the dispatcher. Omitted flags fall back to sensible defaults:
   *  ssr on, rsc when `adapters.getRscData` exists, mcp from `mcpAi.enabled`. `ai` is a reserved slot (not
   *  wired yet). The per-service presets (createSSRServer / createMCPServer) pin these flags for you. */
  services?: ServerServices;
  /** Liveness/readiness endpoint for standalone servers (k8s probes). A stage always answers `path`
   *  (default /health) with 200. The body is the generic identity payload built from `name`/`version`/`role`
   *  ({ Server, Version, role }); pass an explicit `payload` to override it entirely. */
  health?: { path?: string; payload?: Record<string, unknown>; name?: string; version?: string; role?: string };
  /** Cache-buster appended as ?v=<assetVersion> to all default SDK asset URLs (jsPath, cssPath, react vendor). Compute from file mtime or package version at startup. */
  assetVersion?: string;
};

export type ServerServices = {
  ssr?: boolean;
  rsc?: boolean;
  mcp?: boolean;
  ai?: boolean;
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
};

export type SSRServer = {
  listen: (port: number, host?: string) => void;
  close: () => Promise<void>;
  readonly cache: CacheManager | null;
  readonly plugins: PluginRegistry;
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
