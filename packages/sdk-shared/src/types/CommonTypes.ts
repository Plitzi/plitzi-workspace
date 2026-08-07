import type { User } from './AuthTypes';
import type { SSRRscData } from './ServerTypes';

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
  };
  rscData?: SSRRscData;
  /** Path where this origin answers RSC refreshes. Published only by a server that actually mounts the endpoint, so
   *  its absence is what tells a client-only render (embed, builder, offline widget) not to fetch. */
  rscPath?: string;
} & T;

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'widget';
