export type ServerEnvironment = 'production' | 'staging' | 'development' | 'local';

export type Server<T extends Record<string, unknown> = Record<string, unknown>> = {
  apiServer: string;
  ssrServer: string;
  basePath?: string;
  host?: string;
  nodeServer: string;
  graphqlServer: string;
  websocketServer: string;
  subscriptionServer: string;
  location?: Location;
} & T;

export type RenderMode = 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
