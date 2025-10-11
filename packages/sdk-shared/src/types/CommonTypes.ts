export type ServerEnvironment = 'production' | 'staging' | 'development' | 'local';

export type Server = {
  // Dashboard
  apiServer: string;
  ssrServer: string;
  // SDK
  basePath: string;
  host: string;
  nodeServer: string;
  graphqlServer: string;
  websocketServer: string;
  subscriptionServer: string;
  // Others
  location?: Location;
} & Record<string, string>;
