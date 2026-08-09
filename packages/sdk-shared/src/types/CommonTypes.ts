import type { User } from './AuthTypes';
import type { SSRRenderResult, SSRRscData } from './ServerTypes';

export type Environment = 'production' | 'staging' | 'development' | 'main';

export type Server<T extends Record<string, unknown> = Record<string, unknown>> = {
  apiServer: string;
  ssrServer: string;
  basePath?: string;
  host?: string;
  domain?: string;
  requestUrl?: string;
  serverUrl: string;
  websocketServer: string;
  subscriptionServer: string;
  location?: Location;
  authenticated?: boolean;
  skipAuth?: boolean;
  user?: {
    details?: User;
    accessToken?: string | Promise<string>;
    /** Unix seconds the session token dies at, so a hydrated page schedules its renewal without decoding anything. */
    expiresAt?: number;
  };
  ssr?: ServerSSR;
} & T;

/** What the rendering server hands over for THIS render, consumed once at the SDK root and not read from here again:
 *  the RSC bootstrap is projected into the store (`rsc`), which is where the live payload lives from then on. The
 *  rest of `Server` is long-lived configuration — endpoints, session — and stays readable anywhere. */
export type ServerSSR = {
  /** Path where this origin answers RSC refreshes. Published only by a server that actually mounts the endpoint, so
   *  its absence is what tells a client-only render (embed, builder, offline widget) not to fetch. */
  rscPath?: string;
  /** The payload that server already resolved for this page, so the first render costs no request. */
  rscData?: SSRRscData;
  /** Channel the SSR render writes its response into (status, redirect). Server-side only and by reference: it never
   *  crosses to the browser, and nothing subscribes to it. */
  renderResult?: SSRRenderResult;
};

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'widget';
