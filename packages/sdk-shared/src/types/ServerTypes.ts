import type { Environment } from './CommonTypes';
import type { McpServerConfig } from './McpTypes';
import type { OfflineDataRaw } from './SdkTypes';
import type { IncomingHttpHeaders } from 'node:http';

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

export type SSRCredential = {
  provider: string;
  data: unknown;
};

export type PluginAction = 'copy' | 'compile' | 'download';

export type PluginSourceFile = {
  js: string;
  css?: string;
  action?: PluginAction;
  version?: string;
};

export type PluginSourceComponent = {
  component: unknown;
  js?: string;
  css?: string;
  version?: string;
};

export type PluginSource = PluginSourceFile | PluginSourceComponent;

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
  /** When true the client-side <script> block is omitted — useful for inspecting raw SSR HTML. */
  ssrOnly?: boolean;
  debugMode?: boolean;
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

export type SSRAdapters = {
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  onLogin?: (req: SSRRequest) => Promise<boolean>;
  onLogout?: (req: SSRRequest) => Promise<void>;
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
  sdkEnvironment?: 'production' | 'staging' | 'development' | 'local';
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
  adapters: SSRAdapters;
  /** Cache-buster appended as ?v=<assetVersion> to all default SDK asset URLs (jsPath, cssPath, react vendor). Compute from file mtime or package version at startup. */
  assetVersion?: string;
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
