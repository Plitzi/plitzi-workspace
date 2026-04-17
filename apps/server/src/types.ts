import type { OfflineDataRaw, Environment, Server } from '@plitzi/sdk-shared';
import type { IncomingHttpHeaders, ServerHttp2Stream } from 'node:http2';

// ─── Request / Response ──────────────────────────────────────────────────────

export type SSRHeaders = IncomingHttpHeaders & {
  ':authority'?: string;
  ':method'?: string;
  ':path'?: string;
  ':scheme'?: string;
};

/**
 * Normalised request object created from a raw HTTP/1 or HTTP/2 incoming message.
 * Consumers (middlewares, handlers) always receive this shape.
 */
export type SSRRequest = {
  method: string;
  path: string;
  search: string;
  url: string;
  hostname: string;
  protocol: 'http' | 'https';
  headers: SSRHeaders;
  /** Query string parsed into key-value pairs */
  query: Record<string, string>;
  /** If the connection used HTTP/2 streams, the raw stream is available */
  stream?: ServerHttp2Stream;
};

export type SSRResponseHelpers = {
  status: number;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
  setStatus: (code: number) => void;
  send: (body: string) => void;
  end: () => void;
};

// ─── Space Deployment ────────────────────────────────────────────────────────

export type SSRCredential = {
  provider: string;
  data: unknown;
};

export type SSRSpaceDeployment = {
  environment?: Environment;
  credential?: SSRCredential;
  spaceId?: number | null;
  revision?: number;
  error?: {
    code: number;
    message: string;
  };
};

// ─── Adapters ────────────────────────────────────────────────────────────────

/**
 * Functions that the consumer (e.g. plitzi-sdk-server) must provide so that
 * the SSR server can fetch data without importing database modules directly.
 */
export type SSRAdapters = {
  /**
   * Fetch all space/style/segments/collections needed to render a page.
   */
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;

  /**
   * Resolve which space+environment to use for a given inbound request.
   * Called once per request before rendering.
   */
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
};

// ─── Server Config ───────────────────────────────────────────────────────────

export type SSRServerConfig = {
  /** TCP port to listen on. Defaults to 3001 */
  port?: number;
  /** Hostname/IP to bind. Defaults to '0.0.0.0' */
  host?: string;
  /**
   * TLS key + cert for HTTPS/HTTP2.
   * When omitted the server listens in plain-text HTTP/2 (h2c) with HTTP/1 fallback.
   */
  tls?: {
    key: Buffer | string;
    cert: Buffer | string;
  };
  /** SDK environment forwarded to the React component. Defaults to 'production'. */
  sdkEnvironment?: 'production' | 'staging' | 'development';
  /** Filesystem path(s) to serve as static files, keyed by URL prefix. */
  static?: Record<string, string>;
  /**
   * React version used to build importmap URLs.
   * Defaults to the react version in the consumer's package.json.
   */
  reactVersion?: string;
  /**
   * If true, append '?dev' to esm.sh CDN URLs for React.
   * Defaults to `process.env.NODE_ENV !== 'production'`.
   */
  devMode?: boolean;
  /**
   * Adapter callbacks provided by the hosting application.
   */
  adapters: SSRAdapters;
};

// ─── Middleware ───────────────────────────────────────────────────────────────

export type SSRMiddlewareNext = () => Promise<void> | void;

export type SSRMiddleware = (
  req: SSRRequest,
  res: SSRResponseHelpers,
  next: SSRMiddlewareNext
) => Promise<void> | void;

// ─── Context (populated by middlewares) ──────────────────────────────────────

export type SSRContext = {
  spaceDeployment?: SSRSpaceDeployment;
};

// ─── Re-export sdk types used widely ────────────────────────────────────────

export type { OfflineDataRaw, Server };
