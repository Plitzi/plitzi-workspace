export type ServerEnvironment = 'production' | 'staging' | 'development' | 'local';

export type Environment = 'live' | 'staging' | 'development' | 'main';

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
  isAuthenticated?: boolean;
} & T;

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
