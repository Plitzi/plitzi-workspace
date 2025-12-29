import type { User } from './AuthTypes';

export type ServerEnvironment = 'production' | 'staging' | 'development' | 'local';

export type Environment = 'production' | 'staging' | 'development' | 'main';

export type Server<T extends Record<string, unknown> = Record<string, unknown>> = {
  apiServer: string;
  ssrServer: string;
  basePath?: string;
  host?: string;
  domain?: string;
  requestUrl?: string;
  nodeServer: string;
  graphqlServer: string;
  websocketServer: string;
  subscriptionServer: string;
  location?: Location;
  authenticated?: boolean;
  skipAuth?: boolean;
  user?: {
    details?: User;
    accessToken?: string | Promise<string>;
  };
} & T;

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'widget';
