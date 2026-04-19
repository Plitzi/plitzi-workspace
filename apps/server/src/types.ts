import type { OfflineDataRaw, Environment, Server } from '@plitzi/sdk-shared';
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
};

export type SSRResponseHelpers = {
  status: number;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
  setStatus: (code: number) => void;
  send: (body: string) => void;
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
};

export type SSRUser = {
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

export type SSRAdapters = {
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  onLogout?: (req: SSRRequest) => Promise<void>;
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
  reactVersion?: string;
  devMode?: boolean;
  cacheTtlMs?: number;
  logoutPath?: string | false;
  templateFn?: SSRTemplateFn;
  plugins?: Record<string, PluginSource>;
  pluginsCacheDir?: string;
  pluginsTtlMs?: number;
  /** Auto-download and cache plugins declared in the schema's offlineData.plugins list. Default: true. */
  autoLoadSchemaPlugins?: boolean;
  /** Omit client-side JS from the rendered page — useful for verifying SSR HTML without hydration. Default: false. */
  ssrOnly?: boolean;
  adapters: SSRAdapters;
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

export type { OfflineDataRaw, Server };
